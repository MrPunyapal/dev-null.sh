<?php

declare(strict_types=1);

namespace App\Services\LivePlatforms;

use App\Contracts\Services\LivePlatformDriver;
use App\Dto\LiveStream;
use App\Services\EmbedProviders\YouTube as YouTubeEmbeds;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Uri\WhatWg\Url;

final readonly class YouTube implements LivePlatformDriver
{
    public function __construct(private YouTubeEmbeds $embeds)
    {
        //
    }

    public function accepts(string $url): bool
    {
        return $this->videoId($url) !== null;
    }

    /**
     * Public player data identifies an active broadcast without a YouTube API key.
     * Null means YouTube did not provide enough information to verify the status.
     */
    public function isLive(string $url): ?bool
    {
        $videoId = $this->videoId($url);

        if ($videoId === null) {
            return false;
        }

        try {
            $response = Http::connectTimeout(2)
                ->timeout(5)
                ->withoutRedirecting()
                ->get('https://www.youtube.com/watch', ['v' => $videoId]);
        } catch (ConnectionException) {
            return null;
        }

        return $response->ok()
            ? $this->liveStatusFromWatchPage($response->body(), $videoId)
            : null;
    }

    /**
     * The link becomes its plain watch page, so a link to the embed or with a start time opens the stream itself.
     * While a video is live, its `hqdefault_live` thumbnail follows the stream rather than staying on its first frame.
     */
    public function stream(string $url): LiveStream
    {
        $videoId = $this->videoId($url);

        return new LiveStream("https://www.youtube.com/watch?v={$videoId}", "https://i.ytimg.com/vi/{$videoId}/hqdefault_live.jpg");
    }

    /**
     * Check the requested video's player data, not live flags from suggested videos.
     * Balanced braces handle descriptions with quotes, semicolons, or braces.
     */
    private function liveStatusFromWatchPage(string $html, string $videoId): ?bool
    {
        if (preg_match('/\bytInitialPlayerResponse\s*=\s*\{/', $html, $matches, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }

        $start = $matches[0][1] + mb_strlen($matches[0][0], '8bit') - 1;
        $depth = 0;
        $insideString = false;
        $escaped = false;
        $length = mb_strlen($html, '8bit');

        for ($i = $start; $i < $length; $i++) {
            $char = $html[$i];

            if ($insideString) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === '\\') {
                    $escaped = true;
                } elseif ($char === '"') {
                    $insideString = false;
                }

                continue;
            }

            if ($char === '"') {
                $insideString = true;
            } elseif ($char === '{') {
                $depth++;
            } elseif ($char === '}' && $depth-- === 1) {
                $player = json_decode(mb_substr($html, $start, $i - $start + 1, '8bit'), true);

                if (! is_array($player)
                    || data_get($player, 'videoDetails.videoId') !== $videoId
                    || ! is_string(data_get($player, 'playabilityStatus.status'))) {
                    return null;
                }

                return data_get($player, 'playabilityStatus.status') === 'OK'
                    && data_get($player, 'microformat.playerMicroformatRenderer.liveBroadcastDetails.isLiveNow') === true
                    && data_get($player, 'microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp') === null
                    && data_get($player, 'videoDetails.isPostLiveDvr') !== true;
            }
        }

        return null;
    }

    /**
     * Only links that play a single video can be a stream, and only those have a poster, which carries the video's id.
     */
    private function videoId(string $url): ?string
    {
        $parsed = Url::parse($url);
        $poster = $parsed instanceof Url ? $this->embeds->embed($parsed)?->poster : null;

        return preg_match('#^https://i\.ytimg\.com/vi/([A-Za-z0-9_-]{11})/#', (string) $poster, $matches) === 1 ? $matches[1] : null;
    }
}
