import { type Href, Link } from 'expo-router';
import { Pressable } from 'react-native';

import { Text } from './Text';

type Props = {
  label: string;
  prefix?: string;
  href?: Href;
  onPress?: () => void;
  tone?: 'accent' | 'primary';
  align?: 'start' | 'center';
};

/**
 * A text action ("Forgot password?", "Already a member? Log in") with a 44 px touch target,
 * underlined on hover. The target reaches past the line, so the link takes only a line of the
 * layout. With `href` it is a real link: an anchor on the web, with history.
 */
export function TextLink({ label, prefix, href, onPress, tone = 'accent', align = 'center' }: Props) {
  const content = (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={{
        minHeight: 44,
        marginVertical: -10,
        justifyContent: 'center',
        alignSelf: align === 'center' ? 'center' : 'flex-start',
        cursor: 'pointer',
      }}
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text variant="small" tone="muted" style={{ textAlign: align === 'center' ? 'center' : 'left' }}>
          {prefix ? `${prefix} ` : ''}
          <Text
            variant="smallMedium"
            tone={tone}
            style={{ textDecorationLine: hovered ? 'underline' : 'none' }}
          >
            {label}
          </Text>
        </Text>
      )}
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}
