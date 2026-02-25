const ContractRoutes = (apiVersion, servicePath = 'contracts') => {
    return {
        get FETCH_CONTRACT() {
            return `${apiVersion}/${servicePath}/:address`
        },
        get CREATE_CONTRACT() {
            return `${apiVersion}/${servicePath}/create`
        },
        get STORE_DEPLOYMENT() {
            return `${apiVersion}/${servicePath}/deployment`
        },
        get GET_BY_TYPE() {
            return `${apiVersion}/${servicePath}`
        }
    }
}

export default ContractRoutes;