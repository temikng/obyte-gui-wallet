var EventEmitter = require('events').EventEmitter;

class CloudStorageEvents {
  static get Inited() { return 'event:inited'; }
  static get CloseWindow() { return 'event:close_window'; }
  static get DataChanged() { return 'event:data_changed'; }
  static get Login() { return 'event:login'; }
  static get Logout() { return 'event:logout'; }
  static get ChangedAuthStatus() { return 'event:changed_auth_status'; }
  static get AuthAnswer() { return 'event:auth_answer'; }
}

class AbstractCloudStorage extends EventEmitter {
  constructor (options) {
    super();
    this.log = options.log || function () {};
    this._title = options.title;
    this._key = options.key;
    this._clientId = options.clientId;
    this._clientSecret = options.clientSecret;
    this._fetchModule = options.fetchModule;
    if (!options.data) {
      options.data = {};
    }
    this._accessTokenData = options.data.accessTokenData;
    this._accountData = options.data.accountData;
    this._isCordova = options.isCordova;
    this._authorizationWindowOptions = options.authorizationWindowOptions;
    this._authorizationWindow = null;
    this.isInited = false;
  }

  init(options) {
    if ('isCordova' in options) {
      this._isCordova = options.isCordova;
    }
    // if ('fetchModule' in options) {
    //   this._fetchModule = options.fetchModule;
    // }
    this.lodash = require('lodash');
    this.axios = require('axios');
    this.querystring = require('querystring');
    this.url = require('url');
    this._setInited();
  }

  closeAuthorizationWindow() {
    console.log('CloudStorage closeAuthorizationWindow', this._authorizationWindow);
    if (this._authorizationWindow) {
      this._authorizationWindow.close();
      this._authorizationWindow = null;
    }
  }

  getKey() {
    return this._key;
  }

  getTitle() {
    return this._title;
  }

  getAccountName() {
    if (this._accountData) {
      return this._accountData.name;
    }
    return '';
  }

  getRequestAccessTokenParams(code) {
    return {
      'grant_type': 'authorization_code',
      'client_id': this._clientId,
      'client_secret': this._clientSecret,
      'code': code,
      'redirect_uri': this.getAuthRedirectCodeUri()
    };
  }

  getAuthRedirectCodeUri() {
    return `http://localhost:3000/auth/${this._key}`;
  }

  isAuthenticated() {
    return this._accessTokenData && this._accountData;
  }

  isAccessTokenExpired() {
    return false;
  }

  getAuthorizationWindowOptions() {
    return this._authorizationWindowOptions || {
      title: 'oauth',
      frame: true,
    };
  }

  getDataToSave() {
    console.log('CloudStorage getDataToSave');
    return {
      accountData: this._accountData,
      accessTokenData: this._accessTokenData,
    };
  }

  authTokenByCode(code) {
    return this.axios({
      url: this.getRequestAccessTokenUrl(),
      data: this.querystring.stringify(this.getRequestAccessTokenParams(code)),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      method: 'POST'
    });
  }

  authorization() {
    this.emit(CloudStorageEvents.CloseWindow);
    console.log('CloudStorage authorization');

    if (this._isCordova) {
      return this._authorizationWithCordova();
    } else {
      return this._authorizationWithNW();
    }
  }
  _authorizationWithCordova() {
    const endUrl = `http://localhost:3000/auth/${this.getKey()}`;
    return new Promise((resolve, reject) => {
      let bExitWaiting = false;
      const browser = cordova.InAppBrowser.open(
        this.getAuthCodeUrl(), '_blank', 'location=yes'
      );
      this._authorizationWindow = browser;
      browser.addEventListener('loadstart', (evt) => {
        console.log('CloudStorages _authorizationWithCordova evt.url = ' + evt.url, JSON.stringify(evt));
        if(evt.url.indexOf(endUrl) === 0) {
          bExitWaiting = true;
          this.closeAuthorizationWindow();
          var parsedUrl = this.url.parse(evt.url, true);
          this.handleServerAuthReq(parsedUrl)
            .then((isAuth) => {
              resolve(isAuth);
              console.log('CloudStorage handle auth req end', type, isAuth);
            });
        }
      });
      // browser.addEventListener('loaderror', (err) => {
      //   console.log('CloudStorages _authorizationWithCordova on error: '+err.message);
      //   reject(false);
      // });
      browser.addEventListener('exit', () => {
        console.log('CloudStorages _authorizationWithCordova on exit', bExitWaiting);
        if (!bExitWaiting) {
          resolve(false);
        }
      });

      this.once(CloudStorageEvents.AuthAnswer, (isAuth) => {
        console.log('CloudStorage _authorizationWithCordova on AuthAnswer', isAuth);
        resolve(isAuth);
        // win.close();
      });
    });
  }
  _authorizationWithNW() {
    // this.emit(CloudStorageEvents.AuthAnswer, false);
    return new Promise((resolve, reject) => {
      const gui = require('nw.gui');
      console.log('CloudStorage _authorizationWithNW');

      // gui.Shell.openExternal(this.getAuthCodeUrl());
      // this.once(CloudStorageEvents.AuthAnswer, (isAuth) => {
      //   console.log('CloudStorage _authorizationWithNW on AuthAnswer', isAuth);
      //   resolve(isAuth);
      // });

      // TODO: This method does not work with proxy :(
      gui.Window.open(
        this.getAuthCodeUrl(),
        this.getAuthorizationWindowOptions(),
        (win) => {
          if (!win) {
            reject(new Error('The authorization window does not open correct!'));
            return;
          }

          this.once(CloudStorageEvents.AuthAnswer, (isAuth) => {
            console.log('CloudStorage _authorizationWithNW on AuthAnswer', isAuth);
            resolve(isAuth);

            win.close();
          });
          this._authorizationWindow = win;
          win.on('close', () => {
            this._authorizationWindow = null;
            console.log('CloudStorage _authorizationWindow on close');
            win.close(true);
            resolve(false);
          });
          // win.showDevTools();
        }
      );
    });
  }

  authorizationAccount() {
    console.log('CloudStorage authorizationAccount');
    return this.authorization()
      .then((bIsAuthenticated) => {
        console.log('CloudStorage authorizationAccount isAuth', bIsAuthenticated);
        if (bIsAuthenticated) {
          return this.loadAccountData()
            .then((accountData) => {
              this.setAccountData(accountData);
              return true;
            })
            .catch((err) => {
              console.error(err);
              this.clearAuthData(false);
              return false;
            });
        } else {
          return false;
        }
      })
      .catch((error) => {
        console.log('CloudStorage authorizationAccount error', error.message);
        return false;
      });
  }

  handleServerAuthReq(req) {
    console.log(`CloudStorage handleServerAuthReq: ${JSON.stringify(req)}`);
    const code = this.ejectAuthReqCode(req);
    if (code) {
      return this.authTokenByCode(code)
        .then((res) => {
          const accessTokenData = this.ejectAccessTokenData(res);
          const isAuth = Boolean(accessTokenData);
          if (isAuth) {
            console.log('CloudStorage handleServerAuthReq ejected', accessTokenData);
            this.setAccessTokenData(accessTokenData, false);
          }
          this.closeAuthorizationWindow();
          this.emit(CloudStorageEvents.AuthAnswer, isAuth);
          console.log('CloudStorage handleServerAuthReq exit isAuth: ', isAuth);
          return isAuth;
        })
        .catch((err) => {
          console.error(err);
          this.closeAuthorizationWindow();
          this.emit(CloudStorageEvents.AuthAnswer, false);
          return false;
        });
    }
    this.closeAuthorizationWindow();
    this.emit(CloudStorageEvents.AuthAnswer, false);
    return Promise.resolve(false);
  }

  ejectAuthReqCode(req) {
    console.log('CloudStorage ejectAuthReqCode', req);
    var query = req.query;
    if (!query) {
      return;
    }
    if (!query.code) {
      return;
    }
    return query.code;
  }

  setAccountData(data, bEmitEvent = true) {
    console.log('CloudStorage setAccountData', data, bEmitEvent, this.lodash.isEqual(this._accountData, data));
    if (this.lodash.isEqual(this._accountData, data)) {
      return;
    }
    this._accountData = data;
    if (bEmitEvent) {
      this.emit(CloudStorageEvents.DataChanged);
      this.emit(CloudStorageEvents.Login);
    }
  }
  setAccessTokenData(data, bEmitEvent = true) {
    console.log('CloudStorage setAccessTokenData', data, this.lodash.isEqual(this._accessTokenData, data));
    if (this.lodash.isEqual(this._accessTokenData, data)) {
      return;
    }
    this._accessTokenData = data;
    if (bEmitEvent) {
      this.emit(CloudStorageEvents.DataChanged);
      
    }
  }

  clearAuthData(bEmitEvent = true) {
    console.log('CloudStorage clearAuthData');
    const isAuthenticated = this.isAuthenticated();
    this._accountData = null;
    this._accessTokenData = null;
    if (bEmitEvent) {
      this.emit(CloudStorageEvents.DataChanged);
      if (isAuthenticated) this.emit(CloudStorageEvents.Logout);
    }
  }
  execWithCheckAuth(fn) {
    console.log('CloudStorage execWithCheckAuth', fn);
    if (this.isAuthenticated()) {
      console.log('CloudStorage execWithCheckAuth auth');
      return fn()
        .catch((err) => {
          console.log('CloudStorage exec fn ERROR:', err);
          if (this.checkErrAuth(err)) {
            this.clearAuthData();
            throw new ErrorCloudStorageNotAuth();
          }
          throw err;
        });
    } else {
      console.log('CloudStorage execWithCheckAuth not auth');
      return this.authorizationAccount()
        .then((bIsAuthenticated) => {
          if (bIsAuthenticated) {
            return this.execWithCheckAuth(fn);
          } else {
            throw new ErrorCloudStorageNotAuth();
          }
        });
    }
  }

  loadAccountDataAuth() {
    console.log('CloudStorage getAccountDataAuth');
    return this.execWithCheckAuth(() => {
      return this.loadAccountData();
    });
  }

  loadFilesListAuth() {
    console.log('CloudStorage getFilesListAuth');
    return this.execWithCheckAuth(() => {
      return this.loadFilesList();
    });
  }

  uploadFileAuth(filename, data) {
    console.log('CloudStorage uploadFileAuth');
    return this.execWithCheckAuth(() => {
      return this.uploadFile(filename, data);
    });
  }

  downloadFileAuth(filename) {
    console.log('CloudStorage downloadFileAuth');
    return this.execWithCheckAuth(() => {
      return this.downloadFile(filename);
    });
  }

  ejectAccessTokenData(res) {
    throw new Error('function "ejectAccessTokenData" need to initialize');
  }
  getAuthCodeUrl() {
    throw new Error('function "getAuthCodeUrl" need to initialize');
  }
  getRequestAccessTokenUrl() {
    throw new Error('function "getRequestAccessTokenUrl" need to initialize');
  }
  checkErrAuth(err) {
    throw new Error('function "checkErrAuth" need to initialize');
  }
  loadAccountData() {
    throw new Error('function "loadAccountData" need to initialize');
  }
  loadFilesList() {
    throw new Error('function "getFilesList" need to initialize');
  }
  uploadFile(filename, data) {
    throw new Error('function "uploadFile" need to initialize');
  }
  downloadFile(filename) {
    throw new Error('function "downloadFile" need to initialize');
  }

  _setInited() {
    this.isInited = true;
    this.emit(CloudStorageEvents.Inited);
  }
}
