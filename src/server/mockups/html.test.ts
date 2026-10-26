import { describe, expect, it } from 'vitest';
import { findExternalRefs } from './html.ts';

describe('findExternalRefs', () => {
    it('reports resources the browser would load', () => {
        const html = `<!doctype html><html><head>
            <link rel="stylesheet" href="https://cdn.example.com/kit.css">
            <script src='//cdn.example.com/app.js'></script>
            <style>@import "https://fonts.example.com/inter.css";
              body { background: url(https://img.example.com/bg.png) }</style>
            </head><body>
            <img src=https://img.example.com/a.png srcset="https://img.example.com/a@2x.png 2x, local.png 3x">
            <video poster="https://img.example.com/poster.jpg"></video>
            <object data="https://cdn.example.com/chart.svg"></object>
            <svg><use xlink:href="https://cdn.example.com/icons.svg#cart"></use></svg>
            </body></html>`;
        expect(findExternalRefs(html)).toEqual([
            'https://cdn.example.com/kit.css',
            '//cdn.example.com/app.js',
            'https://img.example.com/a.png',
            'https://img.example.com/a@2x.png',
            'https://img.example.com/poster.jpg',
            'https://cdn.example.com/chart.svg',
            'https://cdn.example.com/icons.svg#cart',
            'https://img.example.com/bg.png',
            'https://fonts.example.com/inter.css',
        ]);
    });

    it('ignores links, form actions and local resources', () => {
        const html = `<a href="https://example.com">Docs</a>
            <form action="https://example.com/pay"></form>
            <area href="https://example.com/map">
            <div data-src="https://example.com/lazy.png"></div>
            <img src="data:image/png;base64,AAAA">`;
        expect(findExternalRefs(html)).toEqual([]);
    });
});
