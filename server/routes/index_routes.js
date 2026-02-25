import AccountRoutes from "./account_routes.js";
import LaunchPadRoutes from "./launch_pad_routes.js";
import FileRoutes from "./file_routes.js";
import ContractRoutes from "./contract_routes.js";
import ProjectRoutes from "./project_routes.js";
import DashboardRoutes from "./dashboard_routes.js";
import { API_VERSION } from "../constants.js";

const Routes = {
    ...AccountRoutes(API_VERSION),
    ...LaunchPadRoutes(API_VERSION),
    ...FileRoutes(API_VERSION),
    ...ContractRoutes(API_VERSION),
    ...ProjectRoutes(API_VERSION),
    DASHBOARD_OVERVIEW: `/${API_VERSION}/dashboard/:walletAddress/overview`,
    DASHBOARD_SUBMISSIONS: `/${API_VERSION}/dashboard/:walletAddress/submissions`,
    DASHBOARD_SUBMISSION_VERSIONS: `/${API_VERSION}/dashboard/submissions/:submissionId/versions`,
    DASHBOARD_COLLECTIONS: `/${API_VERSION}/dashboard/:walletAddress/collections`,
    DASHBOARD_REDEMPTIONS: `/${API_VERSION}/dashboard/:walletAddress/redemptions`,
    DASHBOARD_RESPOND_REDEMPTION: `/${API_VERSION}/dashboard/redemptions/:redemptionId/respond`,
    DASHBOARD_CONFIRM_REDEMPTION: `/${API_VERSION}/dashboard/redemptions/:redemptionId/confirm`,
    DASHBOARD_ANALYTICS: `/${API_VERSION}/dashboard/:walletAddress/analytics`,
    DASHBOARD_TRUST_SCORE: `/${API_VERSION}/dashboard/:walletAddress/trust-score`,
    DASHBOARD_SELF_MINT_ELIGIBILITY: `/${API_VERSION}/dashboard/:walletAddress/self-mint-eligibility`,
    DASHBOARD_RESUBMIT: `/${API_VERSION}/dashboard/submissions/:submissionId/resubmit`,
    // Marketplace Analytics Routes
    MARKETPLACE_COLLECTION_STATS: `/${API_VERSION}/marketplace/collections/:contractAddress/stats`,
    MARKETPLACE_COLLECTIONS_STATS: `/${API_VERSION}/marketplace/collections/stats`,
    MARKETPLACE_TRENDING: `/${API_VERSION}/marketplace/trending`,
};

export default Routes;