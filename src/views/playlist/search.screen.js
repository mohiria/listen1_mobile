import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { connect } from 'react-redux';

import Client from '../../api/client';
import { playTrack, openModalLite } from '../../redux/actions';
import { ThemeFlex, TrackRow, ListStatus } from '../../components';
import { showToast } from '../../modules/toast';

class Search extends React.Component {
  props: {
    searchState: Object,
    dispatch: Function,
    getIndex: Function,
    tabIndex: Number,
    platformId: String,
  };

  constructor(props) {
    super(props);
    this.state = {
      tracks: [],
      lastSearch: '',
      total: -1,
      isRefreshing: false,
      failedPage: null,
    };
    this.onEndReachedCalledDuringMomentum = true;
    this.playTrack = this.playTrack.bind(this);
    this.popup = this.popup.bind(this);
    this.onRefresh = this.onRefresh.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    // detect search text change

    const { searchState: nextPlayerState } = nextProps;

    if (this.state.lastSearch !== nextPlayerState.text) {
      // received new search query
      if (this.props.getIndex() === this.props.tabIndex) {
        this.doSearch(nextPlayerState.text);
      }
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    if (
      this.props.searchState.text !== nextProps.searchState.text ||
      this.state !== nextState
    ) {
      return true;
    }

    return false;
  }
  onRefresh = () => {};
  doSearch(text, page) {
    let searchPage = page;

    if (text === '') {
      return;
    }
    if (searchPage === undefined || searchPage === 1) {
      searchPage = 1;
      this.setState({ tracks: [], isRefreshing: true, failedPage: null });
    } else {
      this.setState({ isRefreshing: true, failedPage: null });
    }

    // console.log(`searching ${text} in ${this.props.tabIndex}, page: ${page}`);
    this.setState({});
    Client.search(text, searchPage, this.props.platformId)
      .then(r => {
        if (searchPage === 1) {
          this.flatListRef.scrollToOffset({ animated: true, offset: 0 });
          this.setState({
            tracks: r.result,
            lastSearch: text,
            total: r.total,
            initialized: true,
            isRefreshing: false,
          });
        } else {
          this.setState({
            tracks: [
              ...this.state.tracks.slice(0, (page - 1) * 20),
              ...r.result,
            ],
            lastSearch: text,
            isRefreshing: false,
          });
        }
      })
      .catch(() => {
        // lastSearch is set so that the failed search is not fired again by
        // the next props update; the user retries from the list instead.
        this.setState({
          lastSearch: text,
          isRefreshing: false,
          failedPage: searchPage,
        });
      });
  }
  renderStatus = () => {
    const { isRefreshing, failedPage, lastSearch, tracks } = this.state;

    if (isRefreshing) {
      return null;
    }
    if (failedPage !== null) {
      return (
        <ListStatus
          message="搜索失败"
          onRetry={() => this.doSearch(lastSearch, failedPage)}
        />
      );
    }
    if (lastSearch !== '' && tracks.length === 0) {
      return <ListStatus message="没有结果" />;
    }

    return null;
  };
  handleLoadMore = () => {
    if (this.onEndReachedCalledDuringMomentum) {
      return;
    }
    // after a failure the list waits for the retry button
    if (this.state.failedPage !== null) {
      return;
    }
    if (
      this.state.total !== -1 &&
      this.state.tracks.length >= this.state.total
    ) {
      return;
    }
    const page = Math.ceil(this.state.tracks.length / 20) + 1;

    this.doSearch(this.state.lastSearch, page);
  };
  _keyExtractor = item => item.id;

  playTrack(item) {
    if (item.disabled) {
      return showToast('平台版权原因无法播放，请尝试其它平台');
    }

    return this.props.dispatch(playTrack(item));
  }
  popup(item) {
    this.props.dispatch(openModalLite({ height: 350, type: 'track', item }));
  }

  render() {
    // console.log(`render ${this.constructor.name}`);

    return (
      <ThemeFlex>
        <FlatList
          ref={ref => {
            this.flatListRef = ref;
          }}
          data={this.state.tracks}
          renderItem={({ item }) => {
            return (
              <TrackRow
                onPress={this.playTrack}
                item={item}
                onPressIcon={this.popup}
                iconType="more"
              />
            );
          }}
          keyExtractor={this._keyExtractor}
          ListFooterComponent={this.renderStatus}
          onEndReachedThreshold={0.4}
          onEndReached={this.handleLoadMore}
          onMomentumScrollBegin={() => {
            this.onEndReachedCalledDuringMomentum = false;
          }}
          refreshControl={
            <RefreshControl
              refreshing={this.state.isRefreshing}
              onRefresh={this.onRefresh}
            />
          }
        />
      </ThemeFlex>
    );
  }
}
const mapStateToProps = ({ searchState }) => ({
  searchState,
});

export default connect(mapStateToProps)(Search);
