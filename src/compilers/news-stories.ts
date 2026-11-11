import type { ArticleRef, FeaturedFeed } from "../sources/wikimedia-feed.js";
import { folded } from "./compile-helpers.js";

// The stories of the featured feed that page 110 and pages 111 to 118 share (design.md,
// "Selection rules").

export interface Story {
  /** Folded story text. */
  readonly text: string;
  readonly articles: readonly ArticleRef[];
}

/** The first eight stories whose text folds; story n is the n-th of these. */
export function foldedStories(feed: FeaturedFeed): Story[] {
  const stories: Story[] = [];
  for (const story of feed.news ?? []) {
    const text = folded(story.text);
    if (text !== undefined && stories.length < 8) stories.push({ text, articles: story.articles });
  }
  return stories;
}

export interface Background {
  readonly title: string;
  readonly extract: string;
  readonly url: string | null;
}

/** The first article whose title and extract both fold. */
export function firstBackground(articles: readonly ArticleRef[]): Background | undefined {
  for (const article of articles) {
    const title = folded(article.title);
    const extract = article.extract === null ? undefined : folded(article.extract);
    if (title !== undefined && extract !== undefined) {
      return { title, extract, url: article.url };
    }
  }
  return undefined;
}
