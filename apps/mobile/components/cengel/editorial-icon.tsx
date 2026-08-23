import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { palette } from '@/constants/design';

export type EditorialIconName = ComponentProps<typeof MaterialIcons>['name'];
type CommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const outlinedIconOverrides: Partial<Record<EditorialIconName, CommunityIconName>> = {
  'account-circle': 'account-circle-outline',
  'auto-stories': 'book-open-page-variant-outline',
  lock: 'lock-outline',
  'menu-book': 'book-open-page-variant-outline',
  movie: 'movie-open-outline',
  person: 'account-outline',
  science: 'flask-outline',
  star: 'star-outline',
};

type EditorialIconProps = Omit<ComponentProps<typeof MaterialIcons>, 'name'> & {
  name: EditorialIconName;
};

export function EditorialIcon({ color = palette.ink, size = 24, ...props }: EditorialIconProps) {
  const outlinedName = outlinedIconOverrides[props.name];

  if (outlinedName) {
    return (
      <MaterialCommunityIcons color={color} name={outlinedName} size={size} style={props.style} />
    );
  }

  return <MaterialIcons color={color} size={size} {...props} />;
}
