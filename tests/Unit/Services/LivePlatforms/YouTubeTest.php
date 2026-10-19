<?php

declare(strict_types=1);

use App\Services\LivePlatforms\YouTube;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

it('accepts links to a single video', function (string $url): void {
    $youTube = resolve(YouTube::class);

    expect($youTube->accepts($url))->toBeTrue()
        ->and($youTube->stream($url)->toArray())->toBe([
            'url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'thumbnail_url' => 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault_live.jpg',
        ]);
})->with([
    'watch' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'live' => 'https://www.youtube.com/live/dQw4w9WgXcQ?si=share',
    'short link' => 'https://youtu.be/dQw4w9WgXcQ',
    'embed' => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
]);

it('rejects links that are not a single YouTube video', function (string $url): void {
    expect(resolve(YouTube::class)->accepts($url))->toBeFalse();
})->with([
    'playlist' => 'https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs',
    'twitch' => 'https://www.twitch.tv/octocat',
    'other site' => 'https://example.com/live',
    'not a link' => 'youtube',
]);

it('accepts links while embeds are turned off', function (): void {
    config(['embeds.enabled' => false]);

    expect(resolve(YouTube::class)->accepts('https://youtu.be/dQw4w9WgXcQ'))->toBeTrue();
});

it('checks whether a YouTube stream is actually live', function (string $watchPage, ?bool $expected): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response($watchPage),
    ]);

    expect(resolve(YouTube::class)->isLive('https://youtu.be/dQw4w9WgXcQ'))->toBe($expected);

    Http::assertSent(fn ($request): bool => $request->url() === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
})->with([
    'active broadcast' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        true,
    ],
    'regular upload' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ","isLiveContent":false}};</script>',
        false,
    ],
    'scheduled broadcast' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":false}}}};</script>',
        false,
    ],
    'finished broadcast' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ","isLiveContent":true},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":false}}}};</script>',
        false,
    ],
    'unrelated live recommendation' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ","isLiveContent":false}};var ytInitialData = {"isLiveNow":true};</script>',
        false,
    ],
    'description with braces and escaped quote' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ","shortDescription":"text with \\"quoted\\" words and }; braces"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        true,
    ],
    'mismatched video id' => [
        '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"aaaaaaaaaaa"},"playabilityStatus":{"status":"OK"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        null,
    ],
    'blocked playback' => [
        '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ"},"playabilityStatus":{"status":"UNPLAYABLE"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        false,
    ],
    'finished with stale live flag' => [
        '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","isPostLiveDvr":true},"playabilityStatus":{"status":"OK"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true,"endTimestamp":"2026-10-19T00:00:00Z"}}}};</script>',
        false,
    ],
    'missing video id' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        null,
    ],
    'missing playback status' => [
        '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>',
        null,
    ],
    'not a boolean live value' => [
        '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ"},"playabilityStatus":{"status":"OK"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":"true"}}}};</script>',
        false,
    ],
    'embedded live marker without player response' => [
        '<html>Recommended video isLiveNow:true</html>',
        null,
    ],
    'bad player JSON' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":broken};</script>',
        null,
    ],
    'incomplete player JSON' => [
        '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":',
        null,
    ],
    'no player response' => [
        '<html>Consent required</html>',
        null,
    ],
]);

it('does not request YouTube for invalid video links', function (): void {
    Http::fake();

    expect(resolve(YouTube::class)->isLive('https://www.youtube.com/playlist?list=123'))->toBeFalse();

    Http::assertNothingSent();
});

it('rejects a failed YouTube response', function (): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('Unavailable', 503),
    ]);

    expect(resolve(YouTube::class)->isLive('https://youtu.be/dQw4w9WgXcQ'))->toBeNull();
});

it('does not follow a YouTube redirect', function (): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('', 302, ['Location' => 'https://example.com']),
    ]);

    expect(resolve(YouTube::class)->isLive('https://youtu.be/dQw4w9WgXcQ'))->toBeNull();

    Http::assertSentCount(1);
});

it('rejects a failed connection to YouTube', function (): void {
    Http::fake(fn () => throw new ConnectionException('Connection failed'));

    expect(resolve(YouTube::class)->isLive('https://youtu.be/dQw4w9WgXcQ'))->toBeNull();
});
