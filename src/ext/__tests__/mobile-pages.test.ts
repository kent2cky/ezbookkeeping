import { describe, expect, test } from 'vitest';

// Every mobile business screen, as source text
const pages = import.meta.glob<string>('../mobile/*.vue', { query: '?raw', import: 'default', eager: true });

// A page whose search bar sits under the title (f7-subnavbar) must say so on its f7-page with `with-subnavbar`.
// Without it Framework7 works the class out while rendering and, doing so, can wipe the classes that move the page in:
// the page stays half-shown, tapping Sell seems to do nothing and Back stops working (fixed 10 Oct 2026).
describe('mobile business screens', () => {
    test('there are screens to check', () => {
        expect(Object.keys(pages).length).toBeGreaterThan(5);
    });

    for (const [path, source] of Object.entries(pages)) {
        if (!source.includes('<f7-subnavbar')) {
            continue;
        }

        test(`${path.replace('../mobile/', '')} declares with-subnavbar`, () => {
            const pageTag = /<f7-page\b[^>]*>/.exec(source)?.[0] ?? '';
            expect(pageTag).toMatch(/\swith-subnavbar[\s>=]/);
        });
    }
});
