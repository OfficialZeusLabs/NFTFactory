class Endpoints {
  static API_VERSION = "v1";
  static LOCAL_BASE_ROOT = "http://localhost:8000";
  static REMOTE_BASE_ROOT = "https://nft-assets-ivory.vercel.app";
  static LOCAL_BASE = `${this.LOCAL_BASE_ROOT}/${this.API_VERSION}`;
  static REMOTE_BASE = `${this.REMOTE_BASE_ROOT}/${this.API_VERSION}`;
  static BASE_URL = this.REMOTE_BASE;
  static REGISTER = `${this.BASE_URL}/account/register`;
  static LAUNCHPAD_CREATE_PACKAGE = `${this.BASE_URL}/launchpad/create`;
  static LAUNCHPAD_SUBMIT_PACKAGE = `${this.BASE_URL}/launchpad/create/submit`;
  static UPLOAD_IMAGE = `${this.BASE_URL}/files/upload`;
  static FETCH_ALL_PROJECTS = `${this.BASE_URL}/project/all`;
  static FETCH_PROJECT_DETAIL = `${this.BASE_URL}/project/:id`;
  static CREATE_PROFILE = `${this.BASE_URL}/account/profile/create`;
  static FETCH_PROFILE = `${this.BASE_URL}/account/profile/:address`;
  static UPSERT_PROFILE = `${this.BASE_URL}/account/profile/upsert`;
}

export default Endpoints;
