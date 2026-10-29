<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Contracts\Services\TurnProvider;
use App\Enums\OrgRole;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;

final class ListOrgCallIceServersRequest extends FormRequest
{
    /**
     * Relay credentials cost money, so they only go to someone in the org, about to start or join its call.
     */
    public function authorize(TurnProvider $turn): Response
    {
        $user = $this->user();
        assert($user instanceof User);

        $org = $this->route('org');
        assert($org instanceof Conversation);

        if (! $user->remotes_enabled || ! $org->roleOf($user) instanceof OrgRole) {
            return Response::denyAsNotFound();
        }

        return $turn->isAvailable() ? Response::allow() : Response::deny("Calls aren't available right now.");
    }

    /**
     * @return array{}
     */
    public function rules(): array
    {
        return [];
    }
}
