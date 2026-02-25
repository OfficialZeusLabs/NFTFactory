const LaunchPadRoutes = (apiVersion, servicePath = 'launchpad') => {
    return {
        get CREATE_PACKAGE() {
            return `${apiVersion}/${servicePath}/create`
        },
        get SUBMIT_PACKAGE() {
            return `${apiVersion}/${servicePath}/create/submit`
        }
    }
}

export default LaunchPadRoutes;