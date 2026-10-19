<?php

declare(strict_types=1);

use App\Enums\LivePlatform;
use App\Models\Commit;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function liveUser(): User
{
    return User::factory()->create([
        'live_platform' => LivePlatform::YouTube,
        'live_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'live_ends_at' => now()->addHours(2),
    ]);
}

it('goes live with a YouTube stream for a few hours', function (string $url): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"jfKfPfyJRdk"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>'),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)->fromRoute('user.show', $user)
        ->put(route('user-live.update'), ['url' => " {$url} ", 'hours' => 3])
        ->assertRedirectToRoute('user.show', $user);

    expect($user->refresh())
        ->live_platform->toBe(LivePlatform::YouTube)
        ->live_url->toBe('https://www.youtube.com/watch?v=jfKfPfyJRdk')
        ->and($user->live_ends_at?->toIso8601String())->toBe(now()->addHours(3)->toIso8601String());

    $this->get(route('user.show', $user))
        ->assertInertia(fn ($page) => $page
            ->where('user.live', [
                'url' => 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
                'thumbnail_url' => 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault_live.jpg',
            ]));
})->with([
    'live link' => 'https://www.youtube.com/live/jfKfPfyJRdk?si=share',
    'watch link' => 'https://www.youtube.com/watch?v=jfKfPfyJRdk&t=42s',
    'short link' => 'https://youtu.be/jfKfPfyJRdk',
]);

it('shows the live marker on their commits in the log', function (): void {
    $user = liveUser();
    Commit::factory()->for($user)->create();

    $this->actingAs(User::factory()->create())
        ->get(route('user.show', $user))
        ->assertInertia(fn ($page) => $page
            ->where('commits.data.0.user.live.url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
            ->missing('commits.data.0.user.live_url')
            ->missing('commits.data.0.user.live_ends_at'));
});

it('rejects links that are not a YouTube video', function (array $payload): void {
    Http::fake();

    $user = User::factory()->create();

    $this->actingAs($user)->putJson(route('user-live.update'), [...$payload, 'hours' => 2])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('url');

    expect($user->refresh()->live_url)->toBeNull();

    Http::assertNothingSent();
})->with([
    'missing' => fn (): array => [],
    'not a link' => fn (): array => ['url' => 'youtube'],
    'not a stream' => fn (): array => ['url' => 'https://example.com/live'],
    'twitch' => fn (): array => ['url' => 'https://www.twitch.tv/octocat'],
    'playlist' => fn (): array => ['url' => 'https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs'],
    'too long' => fn (): array => ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&x='.str_repeat('a', 2048)],
]);

it('rejects videos that are not currently live', function (string $watchPage): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response($watchPage),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)->putJson(route('user-live.update'), [
        'url' => 'https://www.youtube.com/live/dQw4w9WgXcQ',
        'hours' => 2,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('url');

    expect($user->refresh()->live_url)->toBeNull();
})->with([
    'regular video' => '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"}};</script>',
    'upcoming stream' => '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":false}}}};</script>',
    'finished stream' => '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":false,"endTimestamp":"2026-10-18T20:00:00Z"}}}};</script>',
]);

it('rejects a YouTube page that cannot be verified', function (): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('<html>Consent required</html>'),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)->putJson(route('user-live.update'), [
        'url' => 'https://youtu.be/dQw4w9WgXcQ',
        'hours' => 2,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('url')
        ->assertJsonPath('errors.url.0', 'Could not verify the YouTube stream right now. Please try again.');

    expect($user->refresh()->live_url)->toBeNull();
});

it('rejects an unavailable YouTube response', function (): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('YouTube unavailable', 503),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)->putJson(route('user-live.update'), [
        'url' => 'https://youtu.be/dQw4w9WgXcQ',
        'hours' => 2,
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.url.0', 'Could not verify the YouTube stream right now. Please try again.');

    expect($user->refresh()->live_url)->toBeNull();
});

it('takes between one and twelve hours', function (mixed $hours): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>'),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)->putJson(route('user-live.update'), ['url' => 'https://youtu.be/dQw4w9WgXcQ', 'hours' => $hours])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('hours');

    expect($user->refresh()->live_url)->toBeNull();
})->with([
    'missing' => null,
    'none' => 0,
    'too many' => User::MAX_LIVE_HOURS + 1,
    'not a number' => 'all day',
]);

it('ends the stream', function (): void {
    $user = liveUser();

    $this->actingAs($user)->fromRoute('user.show', $user)
        ->delete(route('user-live.destroy'))
        ->assertRedirectToRoute('user.show', $user);

    expect($user->refresh())
        ->live_platform->toBeNull()
        ->live_url->toBeNull()
        ->live_ends_at->toBeNull();

    $this->get(route('user.show', $user))
        ->assertInertia(fn ($page) => $page->where('user.live', null));
});

it('stops showing the stream once its hours are up', function (): void {
    $user = liveUser();

    $this->travel(2)->hours();

    $this->get(route('user.show', $user))
        ->assertInertia(fn ($page) => $page->where('user.live', null));
});

it('limits the number of live stream checks per minute', function (): void {
    Http::fake([
        'https://www.youtube.com/watch*' => Http::response('<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"dQw4w9WgXcQ"},"microformat":{"playerMicroformatRenderer":{"liveBroadcastDetails":{"isLiveNow":true}}}};</script>'),
    ]);

    $user = User::factory()->create();
    $payload = ['url' => 'https://youtu.be/dQw4w9WgXcQ', 'hours' => 2];

    for ($i = 0; $i < 6; $i++) {
        $this->actingAs($user)->put(route('user-live.update'), $payload)->assertRedirect();
    }

    $this->actingAs($user)->put(route('user-live.update'), $payload)->assertStatus(429);

    Http::assertSentCount(6);
});

it('requires authentication', function (): void {
    $this->putJson(route('user-live.update'), ['url' => 'https://youtu.be/dQw4w9WgXcQ', 'hours' => 2])->assertUnauthorized();
    $this->deleteJson(route('user-live.destroy'))->assertUnauthorized();
});
