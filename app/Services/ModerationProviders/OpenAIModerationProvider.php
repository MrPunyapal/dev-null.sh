<?php

declare(strict_types=1);

namespace App\Services\ModerationProviders;

use App\Contracts\Services\ModerationProvider;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Enums\Lab;

use function Laravel\Ai\agent;

final readonly class OpenAIModerationProvider implements ModerationProvider
{
    private const string MODERATION_MODEL = 'omni-moderation-latest';

    private const string REVIEW_MODEL = 'gpt-6.1-sol';

    /**
     * Far stricter than OpenAI's own cut-off: any category scoring this much is flagged.
     */
    private const float STRICT_THRESHOLD = 0.2;

    /**
     * @var array<string, float>
     */
    private const array THRESHOLDS = [
        'sexual/minors' => 0.01,
    ];

    private const string HARMFUL_INSTRUCTIONS = <<<'TEXT'
        You review posts on /dev/null, a social network for developers, before they are published.
        Answer whether the post is harmful: a threat, including claims of having a bomb, weapon or explosive, or of
        planning an attack, even as a joke; violence, incitement or glorification of it; hate speech or harassment of a
        person or group; sexual content; encouragement of self-harm; or illegal activity. Developer jargon such as
        "kill the process", "nuke the database" or "this release is the bomb" is not harmful. Disliking a technology
        is not harmful either. When unsure, answer true.
        TEXT;

    /**
     * The categories the content is flagged for, if any, each with its highest score: those OpenAI flags, and those
     * scoring above our own, stricter thresholds. The text, if any, goes along with the first image, and every other
     * image is checked on its own, as a single request is only documented to take one image.
     *
     * @param  list<string>  $imageDataUrls
     * @return array<string, float>
     */
    public function moderate(string $text, array $imageDataUrls = []): array
    {
        $inputs = $text === '' ? [] : [[['type' => 'text', 'text' => $text]]];

        foreach ($imageDataUrls as $index => $imageDataUrl) {
            $image = ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl]];

            if ($index === 0 && $inputs !== []) {
                $inputs[0][] = $image;
            } else {
                $inputs[] = [$image];
            }
        }

        $categories = [];

        foreach ($inputs as $input) {
            /** @var list<array{categories: array<string, bool>, category_scores: array<string, float>}> $results */
            $results = $this->request()
                ->post('moderations', ['model' => self::MODERATION_MODEL, 'input' => $input])
                ->throw()
                ->json('results');

            foreach ($results as $result) {
                foreach ($result['categories'] as $category => $isFlagged) {
                    $score = $result['category_scores'][$category] ?? 0.0;

                    if ($isFlagged || $score >= (self::THRESHOLDS[$category] ?? self::STRICT_THRESHOLD)) {
                        $categories[$category] = max($categories[$category] ?? 0.0, $score);
                    }
                }
            }
        }

        return $categories;
    }

    /**
     * Whether the text is harmful. The moderation model misses threats that are implied rather than spelled out, such
     * as claiming to have a bomb, so a reasoning model is asked too. Anything but a clear no counts as a yes.
     */
    public function isHarmful(string $text): bool
    {
        $answer = agent(
            instructions: self::HARMFUL_INSTRUCTIONS,
            schema: fn (JsonSchema $schema): array => ['harmful' => $schema->boolean()->required()],
        )->prompt(
            $text,
            provider: Lab::OpenAI,
            model: self::REVIEW_MODEL,
            timeout: 60,
        );

        return ($answer['harmful'] ?? null) !== false;
    }

    private function request(): PendingRequest
    {
        $url = config('ai.providers.openai.url');
        assert(is_string($url));

        $key = config('ai.providers.openai.key');
        assert(is_string($key));

        return Http::baseUrl($url)
            ->withToken($key)
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(15);
    }
}
