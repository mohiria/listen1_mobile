import { combineReducers } from 'redux';

import { TYPE } from './actions';
import { myPlaylistReducer } from './myplaylist.reducer';
import { playerReducer } from './player.reducer';
import type { ModalState, SettingState } from './types';

const modalReducer = (
  state: ModalState = {
    isOpen: false,
    isLiteOpen: false,
    liteHeight: 500,
    liteType: '',
    item: {} as ModalState['item'],
  },
  action: any
): ModalState => {
  switch (action.type) {
    case TYPE.TOGGLE_MODAL:
      return { ...state, isOpen: !state.isOpen };
    case TYPE.OPEN_MODEL_LITE:
      return {
        ...state,
        isLiteOpen: true,
        liteHeight: action.payload.height || 500,
        liteType: action.payload.type || '',
        item: action.payload.item || {},
      };
    case TYPE.CLOSE_MODEL_LITE:
      return { ...state, isLiteOpen: false };
    default:
      return state;
  }
};

// theme: 'system' follows the appearance of the device, 'white' and 'black'
// are fixed
const settingReducer = (
  state: SettingState = { language: 'zh_CN', theme: 'system' },
  action: any
): SettingState => {
  switch (action.type) {
    case TYPE.CHANGE_THEME:
      return { ...state, theme: action.theme };
    default:
      return state;
  }
};

const searchReducer = (state = { text: '' }, action: any): { text: string } => {
  switch (action.type) {
    case TYPE.SEARCH:
      return { ...state, text: action.text };
    default:
      return state;
  }
};

export default combineReducers({
  playerState: playerReducer,
  settingState: settingReducer,
  searchState: searchReducer,
  modalState: modalReducer,
  myPlaylistState: myPlaylistReducer,
});
