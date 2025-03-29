// src/utils/modelLoader.js
import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";
import { t } from "../localization/strings"; // Adjust path if needed

// Module-level variables to hold the model state
let _model = null;
let _loadingPromise = null;
let _modelError = null;

// Load the model assets (adjust paths as necessary)
const modelJson = require("../../assets/tfjs_model/model.json");
const modelWeights = [
  require("../../assets/tfjs_model/group1-shard1of5.bin"),
  require("../../assets/tfjs_model/group1-shard2of5.bin"),
  require("../../assets/tfjs_model/group1-shard3of5.bin"),
  require("../../assets/tfjs_model/group1-shard4of5.bin"),
  require("../../assets/tfjs_model/group1-shard5of5.bin"),
];

/**
 * Asynchronously loads the TensorFlow.js model if it hasn't been loaded yet.
 * Returns a promise that resolves with the loaded model or rejects with an error.
 */
export const getModel = async () => {
  // If model is already loaded, return it immediately
  if (_model) {
    console.log("ModelLoader: Returning cached model.");
    return _model;
  }

  // If model loading resulted in an error previously, throw it
  if (_modelError) {
    console.log("ModelLoader: Returning cached error.");
    throw _modelError;
  }

  // If model is currently being loaded by another call, return the existing promise
  if (_loadingPromise) {
    console.log("ModelLoader: Waiting for existing loading promise.");
    return _loadingPromise;
  }

  // Start loading the model
  console.log("ModelLoader: Initiating model loading...");
  _loadingPromise = (async () => {
    try {
      await tf.ready();
      console.log("ModelLoader: TFJS ready. Loading layers model...");
      const loadedModel = await tf.loadLayersModel(
        bundleResourceIO(modelJson, modelWeights)
      );
      console.log("ModelLoader: Model loaded successfully.");
      _model = loadedModel; // Cache the loaded model
      _modelError = null; // Clear any previous error
      return _model;
    } catch (error) {
      console.error("ModelLoader: Error loading model:", error);
      _modelError = new Error(
        t("error_model_load") || "Failed to load analysis model."
      ); // Cache the error
      _model = null; // Ensure model cache is clear on error
      throw _modelError; // Re-throw the error
    } finally {
      _loadingPromise = null; // Clear the loading promise once done (success or fail)
    }
  })();

  return _loadingPromise;
};

/**
 * Checks if the model is currently in the process of loading.
 */
export const isModelLoading = () => {
  return !!_loadingPromise;
};

/**
 * Returns the cached model loading error, if any.
 */
export const getModelError = () => {
  return _modelError;
};

/**
 * (Optional) Function to manually attempt reloading if there was an error.
 */
export const retryLoadModel = () => {
  if (_modelError) {
    // Only retry if there was a known error
    console.log("ModelLoader: Retrying model load...");
    _modelError = null; // Clear the error to allow getModel to try again
    return getModel(); // Trigger loading again
  }
  return Promise.resolve(_model); // Or reject if model is null but no error? Resolve if model exists.
};
