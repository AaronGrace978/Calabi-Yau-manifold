export { PROJECT_TEMPLATES, selectTemplateForPrompt } from './templates.js';
export {
  hashPromptSeed,
  analyzeBuildIntent,
  buildMultiFileSystemPrompt,
  parseMultiFileResponse,
  compileApplicationProject,
  verifyBuildNovelty,
  buildInteractivePreviewHtml,
  bundlePreviewHtml,
} from './appCompiler.js';
export {
  buildHarnessSystemPrompt,
  buildHarnessUserPrompt,
  buildRepairPrompt,
  parseHarnessFiles,
  staticCheckProject,
  checkJsSyntax,
  runLlmBuildHarness,
} from './llmBuildHarness.js';
export {
  verifyAndSelfHealProject,
  runAutonomousBuildLoop,
  isApplicationBuildPrompt,
  isConversationalFillerPrompt,
} from './agentLoop.js';
export {
  computeVietorisRipsPersistence,
  fisherRaoDistance,
  computeBerryGeometricPhase,
  discoverSymbolicInvariants,
  synthesizeCrossLabConsensus,
  computeDeterministicHashHex,
  computeProjectMerkleTree,
  mintProofCarryingCertificate,
  verifyProofCertificate,
  evaluateFrontierWitnessSnapshot,
  generateFrontierWitnessDossierHtml,
} from '../frontier/frontierLabEngine.js';
