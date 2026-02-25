import AccountController from "./account_controller.js";
import LaunchPadController from "./launch_pad_controller.js";
import FileController from "./file_controller.js";
import ContractController from "./contract_controller.js";
import ProjectController from "./project_controller.js";
import DashboardController from "./dashboard_controller.js";
import AdminController from "./admin_controller.js";

class IndexController {
    static initialize(app) {
        AccountController.initialize(app);
        LaunchPadController.initialize(app);
        FileController.initialize(app);
        ContractController.initialize(app);
        ProjectController.initialize(app);
        DashboardController.initialize(app);
        AdminController.initialize(app);
    }
}

export default IndexController;