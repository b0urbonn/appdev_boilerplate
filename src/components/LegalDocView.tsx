import React from 'react';
import { ScrollView, Text } from 'react-native';
import type { LegalDoc } from '@/legal/content';
import { useTheme } from '@/theme';

/** Renders a legal document (privacy policy, terms) as a scrolling page. */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
        Effective {doc.effective}
      </Text>
      {doc.sections.map((section) => (
        <React.Fragment key={section.heading}>
          <Text
            style={{
              color: theme.text,
              fontSize: 16,
              fontWeight: '700',
              marginTop: 16,
              marginBottom: 6,
            }}
          >
            {section.heading}
          </Text>
          {section.body.map((paragraph, i) => (
            <Text
              key={i}
              style={{
                color: theme.text,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 8,
              }}
            >
              {paragraph}
            </Text>
          ))}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}
