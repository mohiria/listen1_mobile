import React, { PureComponent } from 'react';
import { View, Image, TouchableOpacity, Platform } from 'react-native';
import styled, { withTheme } from 'styled-components';
import Client from '../../api/client';
import { FlatGrid } from '../../../vendor/react-native-super-grid';
import { playlistSetting } from '../../config/settings';
import { ListStatus } from '../../components';

const SongTitle = styled.Text`
  font-size: ${playlistSetting.briefTitleFontSize};
  color: ${playlistSetting.briefTitleColor};
  margin-top: 5;
  height: 80;
  color: ${props => props.theme.secondaryColor};
`;

class PlaylistGrid extends PureComponent {
  props: {
    platformId: String,
    navigation: Object,
    theme: Object,
  };
  constructor(props) {
    super(props);
    this.state = { result: [], refreshing: true, failed: false };
  }

  componentDidMount() {
    this.requestData(0);
  }

  requestData = offset => {
    this.setState({ refreshing: true, failed: false });
    Client.showPlaylist(offset, this.props.platformId)
      .then(({ result: r }) => {
        if (offset === 0) {
          this.setState({ result: r, refreshing: false });
        } else {
          this.setState({
            result: this.state.result.concat(r),
            refreshing: false,
          });
        }
      })
      .catch(() => {
        this.setState({ refreshing: false, failed: true });
      });
  };
  renderStatus = () => {
    const { refreshing, failed, result } = this.state;

    if (refreshing) {
      return null;
    }
    if (failed) {
      return (
        <ListStatus
          message="加载失败"
          onRetry={() => this.requestData(result.length)}
        />
      );
    }
    if (result.length === 0) {
      return <ListStatus message="没有歌单" />;
    }

    return null;
  };
  handleLoadMore = () => {
    // after a failure the list waits for the retry button instead of
    // asking again every time it reaches its end
    if (this.state.refreshing || this.state.failed) {
      return;
    }
    this.requestData(this.state.result.length);
  };
  render() {
    // console.log(`render ${this.constructor.name}`);
    const { refreshing } = this.state;
    const itemDimension = 100;
    const titleHeight = 50;

    return (
      <FlatGrid
        itemDimension={itemDimension}
        items={this.state.result}
        refreshing={refreshing}
        onRefresh={() => {
          this.requestData(0);
        }}
        style={{
          backgroundColor: this.props.theme.backgroundColor,
        }}
        // modified FlatGrid version, container style will pass to render Item
        ListHeaderComponent={() => (
          <View
            style={{
              height: Platform.OS === 'android' ? 10 : 0,
              backgroundColor: this.props.theme.backgroundColor,
            }}
          />
        )}
        renderItem={({ item, containerStyle }) => {
          return (
            <TouchableOpacity
              activeOpacity={1} // disable highlight
              onPress={() => {
                this.props.navigation.navigate('Details', {
                  item: { info: item },
                });
              }}
            >
              <View style={{ height: containerStyle.width + titleHeight }}>
                <Image
                  source={{ uri: item.cover_img_url }}
                  style={{
                    width: containerStyle.width,
                    height: containerStyle.width,
                  }}
                  resizeMode="cover"
                />
                <SongTitle>{item.title}</SongTitle>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={this.renderStatus}
        onEndReachedThreshold={0.4}
        onEndReached={this.handleLoadMore}
      />
    );
  }
}
export default withTheme(PlaylistGrid);
