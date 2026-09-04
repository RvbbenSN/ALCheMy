/* --------------------------------------------------------------------------
   ui.js — titulos, epigrafes y encabezados de las pantallas.

   Vivian dentro del JSX, y por eso seguian saliendo en ingles en /es: el
   paquete de idioma solo alcanza lo que esta en content/. Aqui se traducen
   como el resto del texto.

   Una clave por pantalla, y dentro una por titulo. Las de SectionTitle llevan
   {eyebrow, title}; las demas son la cadena suelta.
   -------------------------------------------------------------------------- */

export const UI = {
  "about": {
    "whereTheChemistryHappened": {
      "eyebrow": "Experience",
      "title": "Where the chemistry happened"
    },
    "training": {
      "eyebrow": "Education",
      "title": "Training"
    },
    "publications": {
      "eyebrow": "Scientific production",
      "title": "Publications"
    },
    "competitiveRDProjects": {
      "eyebrow": "Funded research",
      "title": "Competitive R&D projects"
    },
    "whatTheToolboxHolds": {
      "eyebrow": "Skills",
      "title": "What the toolbox holds"
    },
    "writingForAWider": {
      "eyebrow": "Outreach",
      "title": "Writing for a wider audience"
    },
    "contact": {
      "eyebrow": "Get in touch",
      "title": "Contact"
    },
    "rubNSerranoNieto": "Rubén Serrano Nieto",
    "saySomething": "Say something",
    "theContractsBehindThem": "The contracts behind them",
    "orTheDirectRoute": "Or the direct route"
  },
  "collection": {
    "whyThisExists": {
      "eyebrow": "The problem, and the fix",
      "title": "Why this exists"
    },
    "theWorkflowCanvas": {
      "eyebrow": "Interactive",
      "title": "The workflow canvas"
    },
    "whatAIngestedMeasurement": {
      "eyebrow": "Start from the goal",
      "title": "What a ingested measurement looks like"
    },
    "thePostgresqlSchema": {
      "eyebrow": "Where it lands",
      "title": "The PostgreSQL schema"
    },
    "notebooksBehindThisScreen": {
      "eyebrow": "The code itself",
      "title": "Notebooks behind this screen"
    },
    "theIngestionWorkflow": "The Ingestion Workflow",
    "headerMetadata": "Header metadata",
    "rawData": "Raw data",
    "ebTheSameRowOpened": "The same row, opened up"
  },
  "prep": {
    "oneRowPerSynthesis": {
      "eyebrow": "What the table looks like",
      "title": "One row per synthesis"
    },
    "whatEachColumnHolds": {
      "eyebrow": "The variables, before anything is removed",
      "title": "What each column holds"
    },
    "fromSpreadsheetToGoverned": {
      "eyebrow": "Notebook 01",
      "title": "From spreadsheet to governed table"
    },
    "whyTheElementIs": {
      "eyebrow": "From a chemical symbol to physics",
      "title": "Why the element is replaced by its properties"
    },
    "examplesOfSilentData": {
      "eyebrow": "What the expert review found",
      "title": "Examples of silent data bugs"
    },
    "pxrdDiffractogramsAsCore": {
      "eyebrow": "Analytical diagnostic",
      "title": "PXRD diffractograms as core target"
    },
    "fromRawSignalTo": {
      "eyebrow": "Notebook 05 · the centrepiece",
      "title": "From raw signal to 29 numbers"
    },
    "labelerExplorer": {
      "eyebrow": "The tools that produced the ground truth",
      "title": "Labeler & Explorer"
    },
    "whatADiffractogramBecomes": {
      "eyebrow": "PXRD Feature Vector",
      "title": "What a diffractogram becomes"
    },
    "readTheNotebooks": {
      "eyebrow": "The code itself",
      "title": "Read the notebooks"
    },
    "switchLane": {
      "eyebrow": "The other half",
      "title": "Switch lane"
    },
    "etlPxrdSignalProcessing": "ETL & PXRD Signal Processing",
    "paso1HeaderNormalisation": "1 · Header normalisation",
    "paso2StoichiometricFeatureEngineering": "2 · Stoichiometric feature engineering",
    "paso4AnMd5Business": "4 · An MD5 business natural key",
    "paso5TheLoadIs": "5 · The load is an UPSERT, never a replace",
    "whatTheThreeLayers": "What the three layers mean",
    "peakDetectionThe3": "Peak detection: the 3σ threshold",
    "howToReadIt": "How to read it",
    "ebCuration": "Curation",
    "ebADecisionThatCould": "A decision that could have been cheating",
    "ebFillingTheGaps": "Filling the gaps",
    "ebTakeaway": "Takeaway"
  },
  "database": {
    "whatIsInThere": {
      "eyebrow": "At a glance",
      "title": "What is in there"
    },
    "sevenFamiliesAndWhat": {
      "eyebrow": "The map",
      "title": "Seven families, and what feeds what"
    },
    "oneSchemaDocumented": "One Schema, Documented",
    "ebTheCaseForIt": "The case for it",
    "ebTheBoundary": "The boundary",
    "ebTheSurface": "The surface"
  },
  "eda": {
    "theNotebookBehindThis": {
      "eyebrow": "The code itself",
      "title": "The notebook behind this screen"
    },
    "whatThisStageSettled": {
      "eyebrow": "Takeaway",
      "title": "What this stage settled"
    },
    "dataUnderstanding": "Data Understanding",
    "theDecisionHighThroughput": "The decision: high-throughput syntheses only",
    "ebFirstTheName": "First, the name",
    "ebBeforeLoadingAnything": "Before loading anything",
    "ebWhichRowsTheModel": "Which rows the model sees",
    "ebProfiling": "Profiling",
    "ebOneGapDeservesIts": "One gap deserves its own section",
    "ebTheTarget": "The target",
    "ebDistributions": "Distributions",
    "ebAssociation": "Association",
    "ebClassSeparation": "Class separation",
    "ebTheMostImportantSubsection": "The most important subsection",
    "ebALastLookBefore": "A last look before modeling"
  },
  "modeling": {
    "classificationAndWhyNot": {
      "eyebrow": "The framing",
      "title": "Classification, and why not regression"
    },
    "tenModelsNotOne": {
      "eyebrow": "Experimental design",
      "title": "Ten models, not one"
    },
    "whereTheModelStands": {
      "eyebrow": "Performance",
      "title": "Where the model stands"
    },
    "theMetricsAndWhy": {
      "eyebrow": "Evaluation",
      "title": "The metrics, and why accuracy misleads here"
    },
    "whatTheseNumbersActually": {
      "eyebrow": "Results",
      "title": "What these numbers actually say"
    },
    "theNotebookBehindThis": {
      "eyebrow": "The code itself",
      "title": "The notebook behind this screen"
    },
    "whatTheModelingStage": {
      "eyebrow": "Takeaway",
      "title": "What the modeling stage established"
    },
    "trainingEvaluation": "Training & Evaluation",
    "whatAPlateIs": "What a plate is",
    "soTheSplitFollows": "So the split follows the plate",
    "ebValidation": "Validation",
    "ebACriticismOfThe": "A criticism of the problem, not the execution",
    "ebAssessment": "Assessment",
    "ebErrorAnalysis": "Error analysis",
    "ebInterpretation": "Interpretation",
    "ebDirectionNotJustMagnitude": "Direction, not just magnitude"
  },
  "overview": {
    "threeSynchronizedPillars": {
      "eyebrow": "What holds it up",
      "title": "Three synchronized pillars"
    },
    "theTabsFollowTerm": {
      "eyebrow": "How to read this site",
      "titleBefore": "The tabs follow",
      "titleAfter": "in order"
    },
    "aboutTheAuthor": {
      "eyebrow": "Who is behind it",
      "title": "About the author"
    },
    "augmentedLaboratoryForChemistry": "Augmented Laboratory for Chemistry & Materials",
    "stack": "Stack"
  },
  "rag": {
    "whatIsActuallyIndexed": {
      "eyebrow": "The corpus",
      "title": "What is actually indexed"
    },
    "sixStagesEndTo": {
      "eyebrow": "The workflow",
      "title": "Six stages, end to end"
    },
    "theKnowledgeGraph": {
      "eyebrow": "Beyond vectors",
      "title": "The knowledge graph"
    },
    "notebooksBehindThisScreen": {
      "eyebrow": "The code itself",
      "title": "Notebooks behind this screen"
    },
    "scientificCoPilot": "Scientific Co-pilot",
    "theProblem": "The problem",
    "theTechniqueBuiltEnd": "The technique, built end to end",
    "whyItDidNot": "Why it did not help much here",
    "soItIsBuilt": "So it is built and not switched on",
    "ebRetrieval": "Retrieval",
    "ebTheUpgrade": "The upgrade",
    "ebCapabilities": "Capabilities"
  },
  "science": {
    "mofsLabDailyLife": "MOFs & Lab Daily-life",
    "ebTheMaterial": "The material",
    "ebCharacterisation": "Characterisation",
    "ebInsideTheLab": "Inside the lab",
    "ebTheBottleneck": "The bottleneck",
    "ebNext": "Next"
  },
  "model": {
    "inSilicoSynthesis": {
      "eyebrow": "The virtual lab",
      "title": "In-silico synthesis"
    },
    "whatWasTrainedAnd": {
      "eyebrow": "The registry",
      "title": "What was trained, and what survived"
    },
    "simulatorRegistryActiveLearning": "Simulator, Registry & Active Learning",
    "theMapInThe": "The map in the dark",
    "whereItPoints": "Where it points",
    "whatTheMapActually": "What the map actually says",
    "andItAgreesWith": "And it agrees with the diagnosis",
    "ebGovernance": "Governance",
    "ebFeedback": "Feedback"
  }
}
