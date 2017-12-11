import {Observable} from "rxjs/Observable";
import {ajax} from 'rxjs/observable/dom/ajax';
import localStorage from 'store';

const DISPOSE_PASTEBIN = 'DISPOSE_PASTEBIN';

const FETCH_PASTEBIN = 'FETCH_PASTEBIN';
const FETCH_PASTEBIN_FULFILLED = 'FETCH_PASTEBIN_FULFILLED';
const FETCH_PASTEBIN_REJECTED = 'FETCH_PASTEBIN_REJECTED';

const FETCH_PASTEBIN_TOKEN = 'FETCH_PASTEBIN_TOKEN';
const FETCH_PASTEBIN_TOKEN_FULFILLED = 'FETCH_PASTEBIN_TOKEN_FULFILLED';
const FETCH_PASTEBIN_TOKEN_REJECTED = 'FETCH_PASTEBIN_TOKEN_REJECTED';

const AUTH_PASTEBIN = 'AUTH_PASTEBIN';
const AUTH_PASTEBIN_FULFILLED = 'AUTH_PASTEBIN_FULFILLED';
const AUTH_PASTEBIN_REJECTED = 'AUTH_PASTEBIN_REJECTED';

const LOAD_MONACO_EDITOR_FULFILLED = 'LOAD_MONACO_EDITOR_FULFILLED';

const defaultPasteBinState = {
  isFetchingPastebin: false,
  isPastebinFetched: false,
  pastebinId: null,
  pastebinServerAction: null, // created, copied, recovered
  initialEditorsTexts: null,
  isFetchingPastebinToken: false,
  isPastebinTokenFetched: false,
  pastebinToken: null,
  isPastebinAuthenticating: false,
  isPastebinAuthenticated: false,
  authUser: null,
  authUserActionCount: 0
};

export const fetchPastebin = () => {
  // localStorage.set('session', null);
  try{
    const session = localStorage.get('session') ? 'yes' : '';
    const pastebinId = window.location.hash.replace(/#/g, ''); // yes: create a new session
    return {type: FETCH_PASTEBIN, pastebinId: pastebinId, session: session};
  }catch(e){
    return {type: FETCH_PASTEBIN, e:e};
  }

};

const fetchPastebinFulfilled = (session, pastebinId, initialEditorsTexts) => {
  localStorage.set('session', localStorage.get('session') || session);
  window.location.hash = pastebinId;
  return {
    type: FETCH_PASTEBIN_FULFILLED,
    session: localStorage.get('session'),
    pastebinId: pastebinId,
    initialEditorsTexts: initialEditorsTexts
  }
};

const fetchPastebinRejected = error => {
  return {type: FETCH_PASTEBIN_REJECTED, error: error}
};

export const fetchPastebinToken = pastebinId => {
  return {type: FETCH_PASTEBIN_TOKEN, pastebinId: pastebinId};
};

const fetchPastebinTokenFulfilled = pastebinToken => {
  return {type: FETCH_PASTEBIN_TOKEN_FULFILLED, pastebinToken: pastebinToken}
};

const fetchPastebinTokenRejected = error => {
  return {type: FETCH_PASTEBIN_TOKEN_REJECTED, error: error}
};

export const authPastebin = pastebinToken => ({type: AUTH_PASTEBIN, pastebinToken: pastebinToken});
export const authPastebinFulfilled = authUser => ({type: AUTH_PASTEBIN_FULFILLED, authUser: authUser});
export const authPastebinRejected = error => ({type: AUTH_PASTEBIN_REJECTED, error: error});

const cloudFunctionsUrl = 'https://us-central1-firebase-seecoderun.cloudfunctions.net';
const getPasteBinUrl = `${cloudFunctionsUrl}/getPastebin`;
const getPasteBinTokenUrl = `${cloudFunctionsUrl}/getPastebinToken`;

export const pastebinReducer = (state = defaultPasteBinState, action) => {
  switch (action.type) {
    case FETCH_PASTEBIN:
      return {
        ...state,
        isFetchingPastebin: true,
        isPastebinFetched: false,
        pastebinId: action.pastebinId,
        initialEditorsTexts: {},
      };
    case FETCH_PASTEBIN_FULFILLED:
      return {
        ...state,
        isFetchingPastebin: false,
        isPastebinFetched: true,
        pastebinId: action.pastebinId,
        initialEditorsTexts: action.initialEditorsTexts
      };
    case FETCH_PASTEBIN_REJECTED:
      return {
        ...state,
        isFetchingPastebin: false,
        error: action.error
      };
    case FETCH_PASTEBIN_TOKEN:
      return {
        ...state,
        isFetchingPastebinToken: true,
        isPastebinTokenFetched: false,
        pastebinToken: null
      };
    case FETCH_PASTEBIN_TOKEN_FULFILLED:
      return {
        ...state,
        isFetchingPastebinToken: false,
        isPastebinTokenFetched: true,
        pastebinToken: action.pastebinToken
      };
    case FETCH_PASTEBIN_TOKEN_REJECTED:
      return {
        ...state,
        isFetchingPastebinToken: false,
        error: action.error
      };
    case AUTH_PASTEBIN:
      return {
        ...state,
        isPastebinAuthenticating: true,
        isPastebinAuthenticated: false,
        authUser: null,
        authUserActionCount: 0
      };
    case AUTH_PASTEBIN_FULFILLED:
      return {
        ...state,
        isPastebinAuthenticating: false,
        isPastebinAuthenticated: true,
        authUser: action.authUser,
        authUserActionCount: state.authUserActionCount + 1
      };
    case AUTH_PASTEBIN_REJECTED:
      return {
        ...state,
        isPastebinAuthenticating: false,
        error: action.error
      };
    default:
      return state;
  }
};

export const pastebinSubscribe = store => {
  const pastebinUnsubscribe = store.subscribe(() => {
    const state = store.getState();
    if (state.pastebinReducer.error) {
      return;
    }

    if (!state.pastebinReducer.pastebinId) {
      return;
    }

    if (!state.pastebinReducer.isFetchingPastebinToken && !state.pastebinReducer.isPastebinTokenFetched) {
      store.dispatch(fetchPastebinToken(state.pastebinReducer.pastebinId));
    }

    if (!state.pastebinReducer.pastebinToken) {
      return;
    }

    if (!state.pastebinReducer.isPastebinAuthenticating && !state.pastebinReducer.isPastebinAuthenticated) {
      store.dispatch(authPastebin(state.pastebinReducer.pastebinToken));
    }
  });
  return {pastebin: pastebinUnsubscribe};
};

export const disposePastebinEpic = (action$, store, deps) =>
  action$.ofType(DISPOSE_PASTEBIN)
    .mergeMap(() =>
      deps.appManager.observeDispose()
    );

export const pastebinEpic = action$ =>
  action$.ofType(FETCH_PASTEBIN)
    // .mergeMap(action=>Observable.of({type:'LOG', action:action}))
    .mergeMap(action =>
      ajax({
        crossDomain: true,
        withCredentials: false,
        url: `${getPasteBinUrl}?${'session=' + action.session}${action.pastebinId ? '&pastebinId=' + action.pastebinId : ''}`
      }).catch(error =>
        Observable.of(fetchPastebinRejected(error.xhr.response)))
    ).map(result => {
      if (result.error) {
        return fetchPastebinRejected(result.error);
      } else {
        return fetchPastebinFulfilled(result.response.session, result.response.pastebinId, result.response.initialEditorsTexts);
      }
    }
  );
// .startWith(fetchPastebin());

export const pastebinTokenEpic = (action$, store) =>
  action$.ofType(FETCH_PASTEBIN_TOKEN)
    .throttleTime(2000)
    .mergeMap(action =>
      ajax({
        crossDomain: true,
        withCredentials: false,
        url: `${getPasteBinTokenUrl}?pastebinId=${action.pastebinId || store.getState().pastebinReducer.pastebinId}`
      }).catch(error =>
        Observable.of(fetchPastebinTokenRejected(error.xhr.response)))
    ).map(result => {
    if (result.error) {
      return fetchPastebinTokenRejected(result.error);
    } else {
      return fetchPastebinTokenFulfilled(result.response.pastebinToken);
    }
  });


export const authPastebinEpic = (action$, store, deps) =>
  action$.ofType(AUTH_PASTEBIN)
    .throttleTime(2000)
    .mergeMap(action =>
      deps.appManager.observeAuthPastebin(action.pastebinToken || store.getState().pastebinReducer.pastebinToken)
    );
