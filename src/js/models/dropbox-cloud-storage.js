class DropboxCloudStorage extends AbstractCloudStorage {
  constructor (options) {
    super({
      ...options,
      ...{
        title: options.title || 'Dropbox',
        key: options.key || 'dropbox',
      }
    });
    this.dbx = null;
  }

  isAuthenticated() {
    return this._accessTokenData && this._accessTokenData.accessToken && this._accountData;
  }

  initDropboxWithClientId() {
    this.dbx = new this.DropboxModule({ clientId: this._clientId, fetch: this._fetchModule });
  }

  initDropboxWithAccessToken() {
    console.log('DropboxCloudStorage initDropboxWithAccessToken', this._accessTokenData.accessToken);
    this.dbx = new this.DropboxModule({ accessToken: this._accessTokenData.accessToken, fetch: this._fetchModule });
  }

  init(options) {
    super.init(options);
    this.DropboxModule = require('dropbox').Dropbox;

    if (this.isAuthenticated()) {
      console.log('DropboxCloudStorage init auth', this._accessTokenData);
      this.initDropboxWithAccessToken();
      return this.loadAccountData()
        .then((accountData) => {
          this.setAccountData(accountData);
        })
        .catch((err) => {
          this.initDropboxWithClientId();
          this.clearAuthData();
        })
        .then(() => {
          this._setInited();
        });
    } else {
      this.initDropboxWithClientId();
      console.log('DropboxCloudStorage init not auth');
    }
    this._setInited();
    return Promise.resolve();
  }

  getAuthCodeUrl() {
    return this.dbx.getAuthenticationUrl(this.getAuthRedirectCodeUri(), null, 'code');
  }
  getRequestAccessTokenUrl() {
    return 'https://api.dropboxapi.com/oauth2/token';
  }

  ejectAccessTokenData(res) {
    console.log('DropboxCloudStorage ejectAccessTokenData', res);
    const data = res.data;
    if (!data || !data.access_token) {
      return;
    }
    
    return {
      accessToken: data.access_token,
    };
  }

  setAccessTokenData(data, bEmitEvent) {
    super.setAccessTokenData(data, bEmitEvent);
    console.log('DropboxCloudStorage setAccessTokenData', data, bEmitEvent);
    this.initDropboxWithAccessToken();
  }

  clearAuthData(bEmitEvent = true) {
    super.clearAuthData(bEmitEvent);
    console.log('DropboxCloudStorage clearAuthData', bEmitEvent);
    this.initDropboxWithClientId();
  }

  loadAccountData() {
    console.log('DropboxCloudStorage loadAccountData');
    return this.dbx.usersGetCurrentAccount()
      .then((response) => {
        console.log('DropboxCloudStorage loadAccountData response', response);
        const email = response.email;
        const displayName = response.name.display_name;
        return {
          email,
          displayName,
          name: `${displayName} (${email})`
        };
      });
  }

  loadFilesList() {
    return this.dbx.filesListFolder({path: ''})
      .then((response) => {
        console.log('DropboxCloudStorage getFilesList response', response);
        return response.entries;
      })
      .then((list) => {
        return list.filter((item) => {
          return item['.tag'] === 'file';
        });
      });
  }

  uploadFile(filename, data) {
    console.log('DropboxCloudStorage uploadFile', filename, data);
    return this.dbx.filesUpload({
      path: '/' + filename,
      contents: data,
      mode: 'overwrite'
    });
  }

  downloadFile(filename) {
    return this.dbx.filesDownload({
      path: filename,
    });
  }
}
