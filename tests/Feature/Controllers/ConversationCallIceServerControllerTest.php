<?php

declare(strict_types=1);

use App\Contracts\Services\TurnProvider;
use App\Models\User;
use App\Services\TurnProviders\CloudflareTurnProvider;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    config(['remotes.requests' => true, 'remotes.everyone' => true]);
    $this->user = User::factory()->withRemotes()->create();
    $this->partner = User::factory()->withRemotes()->create();
});

it('hands the relay credentials to someone about to call the partner', function (): void {
    sendChatMessage($this->user, $this->partner);
    config(['services.cloudflare_turn.key_id' => 'key', 'services.cloudflare_turn.api_token' => 'token']);
    $this->app->bind(TurnProvider::class, CloudflareTurnProvider::class);
    Http::fake(['rtc.live.cloudflare.com/*' => Http::response(['iceServers' => [
        ['urls' => ['turn:turn.cloudflare.com:3478?transport=udp'], 'username' => 'user', 'credential' => 'secret'],
    ]])]);

    $this->actingAs($this->user)->getJson(route('conversation-call-ice-server.index', $this->partner))
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertExactJson([
            'ice_servers' => [['urls' => ['turn:turn.cloudflare.com:3478?transport=udp'], 'username' => 'user', 'credential' => 'secret']],
            'is_relay_only' => true,
        ]);
});

it('lets browsers connect directly without a relay in testing', function (): void {
    sendChatMessage($this->user, $this->partner);

    $this->actingAs($this->user)->getJson(route('conversation-call-ice-server.index', $this->partner))
        ->assertExactJson(['ice_servers' => [], 'is_relay_only' => false]);
});

it('hides the credentials without a conversation or from someone who cannot message the partner', function (bool $hasConversation): void {
    if ($hasConversation) {
        sendChatMessage($this->user, $this->partner);
        $this->partner->blocking()->attach($this->user);
    }

    $this->actingAs($this->user)->getJson(route('conversation-call-ice-server.index', $this->partner))->assertNotFound();
})->with([true, false]);

it('refuses the credentials while the relay is not configured', function (): void {
    sendChatMessage($this->user, $this->partner);
    config(['services.cloudflare_turn.key_id' => null]);
    $this->app->bind(TurnProvider::class, CloudflareTurnProvider::class);

    $this->actingAs($this->user)->getJson(route('conversation-call-ice-server.index', $this->partner))
        ->assertForbidden()
        ->assertJsonPath('message', "Calls aren't available right now.");
});

it('requires authentication', function (): void {
    $this->getJson(route('conversation-call-ice-server.index', $this->partner))->assertUnauthorized();
});
