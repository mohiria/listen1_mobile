import React from 'react';
import { Image } from 'react-native';

function parseImageUrl(url) {
  if (typeof url === 'string' && url.startsWith('http')) {
    return { uri: url };
  }

  // tracks without a cover (missing or empty img_url) fall back to the logo
  return require('../assets/images/logo.png');
}
export class AImage extends React.PureComponent {
  props: {
    source: String,
  };
  render() {
    const { source, ...props } = this.props;

    return <Image source={parseImageUrl(source)} {...props} />;
  }
}
