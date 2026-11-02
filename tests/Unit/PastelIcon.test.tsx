/// <reference types="node" />
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vite-plus/test';
import { PastelIcon } from '../../resources/js/components/pastel-icon';

test('uses the existing pastel de nata artwork as a decorative achievement icon', () => {
    const html = renderToStaticMarkup(<PastelIcon className="size-3.5" />);

    assert.match(html, /src="\/pastel-de-nata\.svg"/);
    assert.match(html, /class="size-3\.5"/);
    assert.match(html, /alt=""/);
    assert.match(html, /aria-hidden="true"/);
});
