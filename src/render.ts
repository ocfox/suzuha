import { Renderer, Tokens } from "marked";

const SUPPORTED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "a",
  "blockquote",
  "tg-spoiler",
] as const;

const EXPANDABLE_THRESHOLD = { lines: 4, chars: 200 };

function escapeHtml(text: string): string {
  const entities = new Map<string, string>();
  let counter = 0;

  const protectedText = text.replace(
    /&(?:[a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g,
    (match) => {
      const placeholder = `__ENTITY_${counter++}__`;
      entities.set(placeholder, match);
      return placeholder;
    },
  );

  let escaped = protectedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  entities.forEach((value, key) => {
    escaped = escaped.replace(key, value);
  });

  return escaped;
}

function wrapTag(tag: string, content: string, attrs = ""): string {
  return attrs
    ? `<${tag} ${attrs}>${content}</${tag}>`
    : `<${tag}>${content}</${tag}>`;
}

/**
 * Telegram Bot API HTML Renderer for marked.js
 *
 * Converts Markdown to Telegram-compatible HTML format.
 * Supports: <b>, <i>, <u>, <s>, <code>, <pre>, <a>, <blockquote>, <tg-spoiler>
 */
export class TelegramRenderer extends Renderer {
  override text(token: Tokens.Text | Tokens.Escape): string {
    // Workaround for marked bug: handle unparsed ** markers
    // When list items have multiple bold markers with parentheses,
    // marked sometimes fails to parse the second one
    if (token.text.includes("**")) {
      const parts = token.text.split(/\*\*(.+?)\*\*/g);
      return parts
        .map((part, i) => {
          // Odd indices are bold content (matched by the capture group)
          if (i % 2 === 1) {
            return `<b>${escapeHtml(part)}</b>`;
          }
          // Even indices are normal text
          return escapeHtml(part);
        })
        .join("");
    }
    return escapeHtml(token.text);
  }

  override strong(token: Tokens.Strong): string {
    return wrapTag("b", this.parser.parseInline(token.tokens));
  }

  override em(token: Tokens.Em): string {
    return wrapTag("i", this.parser.parseInline(token.tokens));
  }

  override codespan(token: Tokens.Codespan): string {
    return wrapTag("code", escapeHtml(token.text));
  }

  override del(token: Tokens.Del): string {
    return wrapTag("s", this.parser.parseInline(token.tokens));
  }

  override link(token: Tokens.Link): string {
    const href = token.href.replace(/"/g, "&quot;");
    const text = this.parser.parseInline(token.tokens);
    return `<a href="${href}">${text}</a>`;
  }

  override code(token: Tokens.Code): string {
    const code = escapeHtml(token.text);
    return token.lang
      ? `<pre><code class="language-${
        escapeHtml(
          token.lang,
        )
      }">${code}</code></pre>`
      : wrapTag("pre", code);
  }

  override blockquote(token: Tokens.Blockquote): string {
    const body = this.parser.parse(token.tokens).trim();

    const shouldExpand = body.split("\n").filter((line) => line.trim()).length >
        EXPANDABLE_THRESHOLD.lines || body.length > EXPANDABLE_THRESHOLD.chars;

    return (
      wrapTag("blockquote", body, shouldExpand ? "expandable" : "") + "\n\n"
    );
  }

  override heading(token: Tokens.Heading): string {
    const text = this.parser.parseInline(token.tokens);
    return wrapTag("b", text) + "\n\n";
  }

  override paragraph(token: Tokens.Paragraph): string {
    return this.parser.parseInline(token.tokens) + "\n\n";
  }

  override br(): string {
    return "\n";
  }

  override hr(): string {
    return "\n";
  }

  override list(token: Tokens.List): string {
    const parseTextToken = (textToken: Tokens.Text): string => {
      return textToken.tokens && textToken.tokens.length > 0
        ? this.parser.parseInline(textToken.tokens)
        : escapeHtml(textToken.text);
    };

    const parseToken = (t: Tokens.Generic): string => {
      if (t.type === "text") {
        return parseTextToken(t as Tokens.Text);
      }
      if (t.type === "list") {
        return "\n" + this.list(t as Tokens.List).replace(/\n\n$/, "");
      }
      return this.parser.parse([t]).replace(/\n+$/, "");
    };

    const items = token.items.map((item) => {
      const [firstToken] = item.tokens;

      // Single text token
      if (item.tokens.length === 1 && firstToken.type === "text") {
        return parseTextToken(firstToken as Tokens.Text);
      }

      // Single paragraph token
      if (item.tokens.length === 1 && firstToken.type === "paragraph") {
        return this.parser.parseInline((firstToken as Tokens.Paragraph).tokens);
      }

      // Multiple tokens starting with text (e.g., text + nested list)
      if (item.tokens.length > 1 && firstToken.type === "text") {
        return item.tokens.map(parseToken).join("");
      }

      // Complex content
      return this.parser.parse(item.tokens).replace(/\n+$/, "");
    });

    const prefix = token.ordered
      ? (item: string, i: number) => `${i + 1}. ${item}`
      : (item: string) => `• ${item}`;

    return items.map(prefix).join("\n") + "\n\n";
  }

  override listitem(_token: Tokens.ListItem): string {
    // This should not be called directly when list() handles everything
    return "";
  }

  override table(_token: Tokens.Table): string {
    return "";
  }

  override tablerow(token: Tokens.TableRow): string {
    return token.text;
  }

  override tablecell(token: Tokens.TableCell): string {
    return this.parser.parseInline(token.tokens);
  }

  override image(token: Tokens.Image): string {
    const text = token.text || token.title || "Image";
    return `<a href="${token.href}">${text}</a>`;
  }

  override html(token: Tokens.HTML | Tokens.Tag): string {
    const tagMatch = token.text.match(/<\/?([\w-]+)(?:\s[^>]*)?>/);

    if (tagMatch) {
      const tagName = tagMatch[1].toLowerCase();
      if (SUPPORTED_TAGS.includes(tagName as (typeof SUPPORTED_TAGS)[number])) {
        return token.text;
      }
    }

    return token.text.replace(/<[^>]+>/g, "");
  }
}
