import Preconditions from "../utils/preconditions.js";
import ResponseHandler from "../utils/response_handler.js"
import { StatusCodes } from 'http-status-codes';
import Strings from "../lang/strings.js";
import Submission from "../models/submission_model.js";
import { generateSubmissionId } from "../utils/id_generator.js";

class LaunchPadService {
    static async createPackage(req, res) {
        const {
            title, description,
            category, features,
            blockchain, business_information,
            business_type,
            registration_number,
            fullname, website,
            location, role,
            email, phone, metadata,
            portofolio, social,
            achievement,
            additional_information,
            artwork, supply,
            price
        } = req.body;

        const badRequestError = Preconditions.checkNotNull({
            title,
            description,
            email,
            metadata
        });
        if (badRequestError) {
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, badRequestError);
        };
        try {
            const createPackage = await LaunchPadModel.create({
                title,
                description,
                category,
                features,
                blockchain,
                business_information,
                business_type,
                registration_number,
                fullname,
                website,
                location,
                role,
                email,
                phone,
                metadata,
                portofolio,
                social,
                achievement,
                additional_information,
                artwork, supply,
                price
            });
            await createPackage.save();
            return ResponseHandler.sendResponseWithoutData(res, StatusCodes.OK, Strings.PACKAGE_SUCCESSFULLY_CREATED);
        }
        catch (error) {
            console.error(error);
            return ResponseHandler.sendErrorResponse(res, StatusCodes.BAD_REQUEST, Strings.ERROR_RESPONSE);
        }
    }

    /**
     * Submit a new package for admin review (creates a submission)
     */
    static async submitPackage(req, res) {
        const {
            walletAddress,
            project,
            team,
            sales,
            artworks,
            socials,
            productTier
        } = req.body;

        // Validate required fields
        if (!walletAddress || !project || !project.title) {
            return ResponseHandler.sendErrorResponse(
                res, 
                StatusCodes.BAD_REQUEST, 
                "Wallet address and project title are required"
            );
        }

        try {
            // Generate unique submission ID
            const submissionId = generateSubmissionId();
            
            // Calculate SLA deadline (48 hours from now for new submissions)
            const slaDeadline = new Date();
            slaDeadline.setHours(slaDeadline.getHours() + 48);

            // Create submission
            const submission = await Submission.create({
                submissionId,
                walletAddress: walletAddress.toLowerCase(),
                projectName: project.title,
                projectDescription: project.description || "",
                category: project.category || "",
                status: "PENDING",
                currentVersion: 1,
                slaDeadline,
                slaViolated: false,
                productTier: productTier || 0,
                metadata: {
                    project,
                    team,
                    sales,
                    artworks,
                    socials
                },
                submittedAt: new Date(),
                updatedAt: new Date()
            });

            // Create initial version record
            const SubmissionVersion = (await import("../models/submission_version_model.js")).default;
            await SubmissionVersion.create({
                submissionId,
                versionNumber: 1,
                changeType: "INITIAL",
                updatedFields: [],
                snapshot: {
                    title: project.title,
                    description: project.description,
                    category: project.category,
                    metadata: { project, team, sales, artworks, socials }
                },
                createdAt: new Date()
            });

            return ResponseHandler.sendResponseWithData(
                res, 
                StatusCodes.CREATED, 
                "Submission created successfully and is pending admin review",
                { submissionId, status: "PENDING", slaDeadline }
            );
        } catch (error) {
            console.error("Error creating submission:", error);
            return ResponseHandler.sendErrorResponse(
                res, 
                StatusCodes.INTERNAL_SERVER_ERROR, 
                "Failed to create submission"
            );
        }
    }
}

export default LaunchPadService;

import LaunchPadModel from "../models/launch_pad_model.js";
import FileService from "./file_service.js";