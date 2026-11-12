// Minimal Markdown renderer for chat output. Dependency-free on purpose —
// students can swap this for react-native-markdown-display later.
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../theme';

const MONO = Platform.select({ android: 'monospace', default: 'monospace' });

interface Props {
  text: string;
  color: string;
  theme: Theme;
}

/** `inline code`, **bold**, *italic* / _italic_ runs inside one line. */
function renderInline(line: string, key: string, color: string, theme: Theme) {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  const runs: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) runs.push(line.slice(last, m.index));
    const token = m[0];
    const k = `${key}-${i++}`;
    if (token.startsWith('`')) {
      runs.push(
        <Text key={k} style={{ fontFamily: MONO, backgroundColor: theme.card }}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('**')) {
      runs.push(
        <Text key={k} style={{ fontWeight: '700' }}>
          {token.slice(2, -2)}
        </Text>
      );
    } else {
      runs.push(
        <Text key={k} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </Text>
      );
    }
    last = m.index + token.length;
  }
  if (last < line.length) runs.push(line.slice(last));
  return runs;
}

/** One non-code block: headings, lists, and paragraphs separated by blanks. */
function renderTextBlock(text: string, base: string, color: string, theme: Theme) {
  const nodes: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const key = `${base}-p${nodes.length}`;
    nodes.push(
      <Text key={key} style={[styles.text, { color }]}>
        {para.map((l, i) => (
          <React.Fragment key={i}>{i > 0 && '\n'}{renderInline(l, `${key}-${i}`, color, theme)}</React.Fragment>
        ))}
      </Text>
    );
    para = [];
  };

  for (const line of text.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)/);
    const key = `${base}-l${nodes.length}-${para.length}`;
    if (heading) {
      flush();
      const size = heading[1].length === 1 ? 18 : heading[1].length === 2 ? 17 : 16;
      nodes.push(
        <Text key={key} style={[styles.heading, { color, fontSize: size }]}>
          {renderInline(heading[2], key, color, theme)}
        </Text>
      );
    } else if (bullet) {
      flush();
      nodes.push(
        <Text key={key} style={[styles.text, styles.indented, { color }]}>
          {'  • '}{renderInline(bullet[1], key, color, theme)}
        </Text>
      );
    } else if (numbered) {
      flush();
      nodes.push(
        <Text key={key} style={[styles.text, styles.indented, { color }]}>
          {`  ${numbered[1]}. `}{renderInline(numbered[2], key, color, theme)}
        </Text>
      );
    } else if (line.trim() === '') {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return nodes;
}

export const MarkdownText = React.memo(function MarkdownText({ text, color, theme }: Props) {
  // Odd chunks between ``` fences are code; an unclosed trailing fence
  // (still streaming) is rendered as code too.
  const chunks = text.split('```');
  const nodes: React.ReactNode[] = [];
  chunks.forEach((chunk, i) => {
    const isCode = i % 2 === 1;
    if (isCode) {
      const nl = chunk.indexOf('\n');
      const firstLine = nl === -1 ? chunk : chunk.slice(0, nl);
      const body =
        nl === -1 ? (firstLine.includes(' ') ? chunk : '') : chunk.slice(nl + 1);
      nodes.push(
        <View
          key={`c${i}`}
          style={[styles.code, { backgroundColor: theme.card }]}
        >
          <Text style={[styles.codeText, { color }]}>{body}</Text>
        </View>
      );
    } else if (chunk.trim()) {
      nodes.push(...renderTextBlock(chunk, `t${i}`, color, theme));
    }
  });
  return <View style={styles.container}>{nodes}</View>;
});

const styles = StyleSheet.create({
  container: { gap: 8 },
  text: { fontSize: 16, lineHeight: 22 },
  heading: { fontWeight: '700', lineHeight: 24 },
  indented: { paddingLeft: 4 },
  code: { borderRadius: 8, padding: 10 },
  codeText: { fontFamily: MONO, fontSize: 13 },
});
