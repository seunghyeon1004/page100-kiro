# Font

`bedstead-extended-subset.woff2` is a subset of **Bedstead Extended 3.261** by Ben Harris
(<https://bjh21.me.uk/bedstead/>), an outline font based on the characters of the SAA5050 teletext
character generator chip.

Licence: public domain. The author's statement (<https://bjh21.me.uk/bedstead/#copyright>):

> The program that generates Bedstead and all of the newly-designed glyphs have been released into
> the public domain. I believe that the original SAA5050 bitmap font is essentially in the public
> domain in the United Kingdom as a result of Section 55 of the Copyright, Designs and Patents Act
> 1988 as applied by subparagraph 14(5) of Schedule 1.

The subset holds the 160 text code points of the repertoire (`src/grid/repertoire.ts`), the 63
contiguous mosaic patterns (U+258C, U+2590, U+2588, U+1FB00 to U+1FB3B) and the 63 separated
mosaics (U+1CE51 to U+1CE8F): 286 code points, 4,624 bytes.

`bedstead-extended-subset.coverage.json` lists the code points in the file. It is written by
`scripts/subset-font.sh`, and a test compares it with the repertoire.

Bedstead Extended has an advance of 750 units on a 1000-unit em. With `line-height: 1` a
40 by 24 grid is therefore 30em by 24em, a 5:4 screen.
