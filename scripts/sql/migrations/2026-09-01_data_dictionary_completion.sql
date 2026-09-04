-- =============================================================================
-- ddl_data_dictionary_completion.sql
--
-- Completa data_dictionary hasta cubrir TODAS las columnas de TODAS las tablas
-- y vistas del esquema public.
--
-- POR QUE HACIA FALTA
-- -------------------
-- data_dictionary existe para que la futura aplicacion web y los agentes de IA
-- lean la documentacion del esquema DESDE LA BASE, en vez de llevarla escrita a
-- mano en el codigo. Una auditoria del 2026-08-29 mostro que solo cubria el
-- 42,4 % de las columnas (200 de 472), con 14 objetos al 0 %. Un diccionario a
-- medias es peor que no tenerlo: un agente que lo consulta no distingue entre
-- "esta columna no esta documentada" y "esta columna no existe".
--
-- QUE HACE
--   1. Borra 8 filas huerfanas que describian columnas que el DDL nunca creo.
--   2. Anade las ~252 columnas que faltaban.
--   3. Pone COMMENT ON TABLE en los 4 objetos que no lo tenian.
--
-- Idempotente: ON CONFLICT DO UPDATE, se puede reaplicar sin duplicar.
--
-- APLICAR CON
--   python scripts/backup_database.py
--   docker exec -i alchemy_postgres psql -U alchemy_user -d alchemy_db \
--       < scripts/ddl_data_dictionary_completion.sql
--   python src/sync_data_dictionary.py --audit     (comprobar que da 100 %)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (a) Filas huerfanas: documentaban columnas que synthesis_experiments nunca
--     llego a tener. Vienen de DATA_DICTIONARY_AND_SCHEMA.md, que describe un
--     esquema mas ambicioso que el que scripts/init_db.sql crea de verdad (la
--     "Section 6: Experimental Weighings & Yield" que CLAUDE.md lista como
--     rugosidad conocida). El diccionario debe describir lo que EXISTE; el
--     diseno pendiente vive en el documento de metodologia, no aqui.
-- -----------------------------------------------------------------------------
DELETE FROM data_dictionary d
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = d.table_name
      AND c.column_name = d.column_name);


-- -----------------------------------------------------------------------------
-- (b) Las columnas que faltaban.
-- -----------------------------------------------------------------------------
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES

-- ==================== element_properties ====================
('element_properties','atomic_number','Atomic number','IDENTITY',NULL,'INTEGER',NULL,'Number of protons. Fixes the element identity.'),
('element_properties','atomic_mass_u','Atomic mass','CHEMISTRY','u','DOUBLE PRECISION',NULL,'Standard atomic weight, used to convert weighed mass into moles.'),
('element_properties','period','Period','CHEMISTRY',NULL,'INTEGER',NULL,'Row of the periodic table. Proxy for principal quantum number and therefore for size.'),
('element_properties','group_number','Group','CHEMISTRY',NULL,'INTEGER',NULL,'Column of the periodic table. Groups share valence configuration and typical oxidation states.'),
('element_properties','block','Block','CHEMISTRY',NULL,'VARCHAR(2)','s | p | d | f','Block of the periodic table, i.e. which subshell is being filled.'),
('element_properties','is_transition_metal','Is transition metal','CHEMISTRY',NULL,'BOOLEAN',NULL,'TRUE for d-block metals, whose partially filled d orbitals allow variable oxidation states and ligand-field effects.'),
('element_properties','is_lanthanide','Is lanthanide','CHEMISTRY',NULL,'BOOLEAN',NULL,'TRUE for f-block lanthanides. Relevant because several tabulated scales (notably Allen electronegativity) are undefined for them.'),
('element_properties','ionization_energy_1_ev','First ionisation energy','CHEMISTRY','eV','DOUBLE PRECISION',NULL,'Energy to remove the first electron. One of the two inputs to Pearson hardness.'),
('element_properties','electron_affinity_ev','Electron affinity','CHEMISTRY','eV','DOUBLE PRECISION',NULL,'Energy released on gaining an electron. NULL for Mg and Zn: their filled shells do not bind an extra electron, so hardness cannot be computed for them.'),
('element_properties','covalent_radius_pm','Covalent radius','CHEMISTRY','pm','DOUBLE PRECISION',NULL,'Radius of the neutral atom in a covalent bond. Distinct from the ionic radius in ion_properties, which is the one that matters for coordination.'),
('element_properties','atomic_radius_pm','Atomic radius','CHEMISTRY','pm','DOUBLE PRECISION',NULL,'Radius of the free neutral atom.'),
('element_properties','polarizability_a3','Polarisability','CHEMISTRY','A^3','DOUBLE PRECISION',NULL,'How easily the electron cloud deforms. Underlies the soft end of HSAB reasoning: soft cations are the polarisable ones.'),
('element_properties','loaded_at','Loaded at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the row was written by build_element_properties.py.'),

-- ==================== ion_properties ====================
('ion_properties','symbol','Element symbol','IDENTITY',NULL,'VARCHAR(3)',NULL,'Element symbol, foreign key to element_properties.'),
('ion_properties','coordination_number','Coordination number','CHEMISTRY',NULL,'INTEGER',NULL,'Number of donor atoms around the cation. Pinned to 6 across this project: the true value is unknown before synthesis, and Shannon CN=6 radii are both the best tabulated and the ones that preserve the ordering between metals.'),
('ion_properties','spin_state','Spin state','CHEMISTRY',NULL,'VARCHAR(10)','HS | LS | (empty)','High or low spin, which changes the ionic radius. Empty string means no such ambiguity applies; empty rather than NULL because PostgreSQL forbids NULL in a primary key.'),
('ion_properties','crystal_radius_pm','Crystal radius','CHEMISTRY','pm','DOUBLE PRECISION',NULL,'Shannon crystal radius. Differs from the effective ionic radius by a constant offset; the ionic one is used throughout.'),
('ion_properties','data_source','Data source','PROVENANCE',NULL,'VARCHAR(50)',NULL,'Which tool or table produced the row, e.g. pymatgen_shannon.'),

-- ==================== metal_source_oxidation_state ====================
('metal_source_oxidation_state','symbol','Element implied','CHEMISTRY',NULL,'VARCHAR(3)',NULL,'Element that the precursor formula actually implies, which is not always the one recorded in metal_center.'),
('metal_source_oxidation_state','oxidation_state','Oxidation state','CHEMISTRY',NULL,'INTEGER',NULL,'Charge of the metal in the precursor salt as weighed, deduced from charge balance. Deliberately not the charge in the final MOF, which is unknown before synthesis.'),
('metal_source_oxidation_state','basis','Basis of assignment','PROVENANCE',NULL,'VARCHAR(30)','formula_charge_balance | known_reagent | human_review_pending','How the oxidation state was decided. Recording the basis separates deduction from assumption.'),
('metal_source_oxidation_state','notes','Notes','PROVENANCE',NULL,'TEXT',NULL,'Free text, typically the reasoning for an ambiguous formula or a typographic variant of a known reagent.'),

-- ==================== property_sources ====================
('property_sources','property_name','Property name','IDENTITY',NULL,'VARCHAR(60)',NULL,'Name of the property being cited, matching the column it documents.'),
('property_sources','source_citation','Citation','PROVENANCE',NULL,'TEXT',NULL,'Full literature citation. Exists because a number without its source is an incomplete number: electronegativity alone is ambiguous, since Pauling and Allen order transition metals differently.'),
('property_sources','source_doi','DOI','PROVENANCE',NULL,'TEXT',NULL,'DOI of the source, so the value can be traced to the exact table it came from.'),
('property_sources','scale_notes','Scale notes','PROVENANCE',NULL,'TEXT',NULL,'Which scale or convention the value follows, and any caveat about its applicability.'),

-- ==================== linker_properties ====================
('linker_properties','iupac_name','IUPAC name','IDENTITY',NULL,'TEXT',NULL,'Systematic name, unambiguous where the lab abbreviation is not.'),
('linker_properties','common_name','Common name','IDENTITY',NULL,'TEXT',NULL,'Name as used in the laboratory and the literature.'),
('linker_properties','smiles','SMILES','IDENTITY',NULL,'TEXT',NULL,'Machine-readable structure. This, and not the abbreviation, is what identifies the molecule: two papers can use different four-letter codes for the same compound.'),
('linker_properties','inchikey','InChIKey','IDENTITY',NULL,'VARCHAR(27)',NULL,'Hashed structural identifier, suitable for exact lookup across databases.'),
('linker_properties','denticity','Denticity','CHEMISTRY',NULL,'INTEGER',NULL,'Number of donor sites able to bind a metal. NULL where it is not well defined, as for tannic acid with its many phenolic hydroxyls.'),
('linker_properties','n_donor_atoms','Donor atoms','CHEMISTRY',NULL,'INTEGER',NULL,'Count of atoms that can coordinate a metal centre.'),
('linker_properties','n_acidic_protons','Acidic protons','CHEMISTRY',NULL,'INTEGER',NULL,'Protons that can be lost on coordination. Governs how strongly pH controls whether the linker can bind at all.'),
('linker_properties','donor_group','Donor group','CHEMISTRY',NULL,'VARCHAR(20)','phosphonate | phenol | none','Chemical family of the coordinating group.'),
('linker_properties','molecular_weight','Molecular weight','CHEMISTRY','g/mol','DOUBLE PRECISION',NULL,'Used to convert weighed mass into moles.'),
('linker_properties','n_aromatic_rings','Aromatic rings','CHEMISTRY',NULL,'INTEGER',NULL,'Number of aromatic rings. Proxy for rigidity and for pi stacking.'),
('linker_properties','tpsa','Topological polar surface area','CHEMISTRY','A^2','DOUBLE PRECISION',NULL,'Computed polar surface area, a proxy for polarity and solvation behaviour.'),
('linker_properties','clogp','cLogP','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Calculated octanol-water partition coefficient, a proxy for hydrophobicity.'),
('linker_properties','n_rotatable_bonds','Rotatable bonds','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Conformational flexibility. A flexible linker can adopt more topologies, which cuts both ways for crystallisation.'),
('linker_properties','computed_with','Computed with','PROVENANCE',NULL,'VARCHAR(50)',NULL,'Tool and version that produced the descriptors, typically RDKit.'),
('linker_properties','notes','Notes','PROVENANCE',NULL,'TEXT',NULL,'Free text, typically how the identity was confirmed against the literature.'),

-- ==================== ml_datasets ====================
('ml_datasets','dataset_id','Dataset ID','IDENTITY',NULL,'SERIAL',NULL,'Surrogate primary key.'),
('ml_datasets','dataset_slug','Dataset slug','IDENTITY',NULL,'VARCHAR(80)',NULL,'Stable readable identifier for the training snapshot.'),
('ml_datasets','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the snapshot was registered.'),
('ml_datasets','source_query','Source query','REPRODUCIBILITY',NULL,'TEXT',NULL,'The literal SQL that defined the dataset, stored unsummarised. Without it, filters live only in a notebook that may change.'),
('ml_datasets','feature_source','Feature source','REPRODUCIBILITY',NULL,'VARCHAR(80)',NULL,'Which view or table version supplied the features, e.g. v_ml_features v2.'),
('ml_datasets','n_rows','Row count','STATISTICS',NULL,'INTEGER',NULL,'Rows in the snapshot. Together with query_sha256, a change here proves the data moved even when the SQL is identical.'),
('ml_datasets','n_features','Feature count','STATISTICS',NULL,'INTEGER',NULL,'Number of input columns actually fed to the model.'),
('ml_datasets','target_column','Target column','IDENTITY',NULL,'VARCHAR(60)',NULL,'Name of the variable being predicted.'),
('ml_datasets','class_distribution','Class distribution','STATISTICS',NULL,'JSONB',NULL,'Count per class. Detects both class imbalance and silent drift between two runs of the same query.'),
('ml_datasets','filters_human','Filters, in words','REPRODUCIBILITY',NULL,'TEXT',NULL,'The filters described in plain language, for a reader who will not parse the SQL.'),

-- ==================== ml_models ====================
('ml_models','model_id','Model ID','IDENTITY',NULL,'SERIAL',NULL,'Surrogate primary key.'),
('ml_models','display_name','Display name','IDENTITY',NULL,'TEXT',NULL,'Human-readable name for interfaces and reports.'),
('ml_models','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the model was registered.'),
('ml_models','task_type','Task type','DESIGN',NULL,'VARCHAR(40)','multiclass_classification | binary_classification | regression | clustering','Kind of learning problem, which determines which metrics even apply: MRE and R2 are regression metrics and mean nothing for a classifier.'),
('ml_models','target_column','Target column','DESIGN',NULL,'VARCHAR(60)',NULL,'Variable predicted by this model.'),
('ml_models','target_classes','Target classes','DESIGN',NULL,'TEXT[]',NULL,'Class labels, stored in ordinal order where the target has one, so that neighbouring-class errors can be told apart from extreme ones.'),
('ml_models','question','Laboratory question','DESIGN',NULL,'TEXT',NULL,'The question the model answers, in one sentence and in laboratory terms rather than statistical ones.'),
('ml_models','dataset_id','Dataset','REPRODUCIBILITY',NULL,'INTEGER',NULL,'Foreign key to the training snapshot in ml_datasets.'),
('ml_models','algorithm','Algorithm','DESIGN',NULL,'VARCHAR(80)',NULL,'Estimator class, e.g. RandomForestClassifier.'),
('ml_models','library','Library','REPRODUCIBILITY',NULL,'VARCHAR(40)','scikit-learn | lightgbm | xgboost','Library providing the estimator.'),
('ml_models','hyperparameters','Hyperparameters','REPRODUCIBILITY',NULL,'JSONB',NULL,'Parameters of the final estimator, stored explicitly rather than left implicit in code.'),
('ml_models','preprocessing','Preprocessing','REPRODUCIBILITY',NULL,'JSONB',NULL,'Imputation, scaling and encoding steps. A model without its preprocessing cannot predict on raw data, so this is part of the model, not context.'),
('ml_models','validation_scheme','Validation scheme','REPRODUCIBILITY',NULL,'JSONB',NULL,'How performance was estimated, including the grouping key. Grouped cross-validation and random splits give very different numbers on the same data.'),
('ml_models','source_notebook','Source notebook','REPRODUCIBILITY',NULL,'TEXT',NULL,'Notebook or script that produced the model.'),
('ml_models','python_version','Python version','REPRODUCIBILITY',NULL,'VARCHAR(20)',NULL,'Interpreter version used for training.'),
('ml_models','platform','Platform','REPRODUCIBILITY',NULL,'TEXT',NULL,'Operating system and architecture, which can change floating-point details.'),
('ml_models','superseded_by','Superseded by','GOVERNANCE',NULL,'INTEGER',NULL,'Model that replaced this one, so the lineage can be walked in both directions.'),
('ml_models','not_reproducible_reason','Reason not reproducible','GOVERNANCE',NULL,'TEXT',NULL,'Why the model cannot be rebuilt. A CHECK constraint makes it mandatory whenever is_reproducible is FALSE, so the field cannot stay empty precisely when it matters most.'),
('ml_models','is_deployed','Is deployed','GOVERNANCE',NULL,'BOOLEAN',NULL,'Whether the model is in live use. Registered and deployed are different states and are kept apart on purpose.'),
('ml_models','notes','Notes','GOVERNANCE',NULL,'TEXT',NULL,'Why the model exists and what changed with respect to its predecessor.'),

-- ==================== ml_model_metrics ====================
('ml_model_metrics','model_id','Model','IDENTITY',NULL,'INTEGER',NULL,'Foreign key to ml_models.'),
('ml_model_metrics','metric_name','Metric name','STATISTICS',NULL,'VARCHAR(40)','f1_macro | balanced_accuracy | matthews_corrcoef | accuracy','Which metric. Long format means adding a new one needs no schema change.'),
('ml_model_metrics','split','Split','STATISTICS',NULL,'VARCHAR(20)','cv | holdout | train','Which partition the value refers to. A training-set score and a cross-validated score are not comparable and must never be mixed.'),
('ml_model_metrics','metric_value','Value','STATISTICS',NULL,'DOUBLE PRECISION',NULL,'The metric value, averaged across folds when split is cv.'),
('ml_model_metrics','n_folds','Folds','STATISTICS',NULL,'INTEGER',NULL,'Number of cross-validation folds behind the value.'),
('ml_model_metrics','class_name','Class','STATISTICS',NULL,'VARCHAR(40)',NULL,'Empty string for an aggregate metric; otherwise the class the metric refers to. Empty rather than NULL because it is part of the primary key.'),

-- ==================== ml_model_features ====================
('ml_model_features','model_id','Model','IDENTITY',NULL,'INTEGER',NULL,'Foreign key to ml_models.'),
('ml_model_features','feature_name','Feature name','DESIGN',NULL,'VARCHAR(80)',NULL,'Column name as it appears in the feature source.'),
('ml_model_features','feature_role','Role','DESIGN',NULL,'VARCHAR(20)','input | group | target | excluded','What the column did. Recording group separately matters: a grouping key must never be a model input.'),
('ml_model_features','feature_block','Chemical block','DESIGN',NULL,'VARCHAR(40)','metal | linker | process | medium','Chemical family the feature belongs to. Importance is interpreted by block, because correlated features share credit arbitrarily.'),
('ml_model_features','importance','Importance','STATISTICS',NULL,'DOUBLE PRECISION',NULL,'Permutation importance, i.e. the drop in score when the column is shuffled. A negative value means shuffling improves the model, which is the operational definition of noise.'),
('ml_model_features','exclusion_reason','Exclusion reason','GOVERNANCE',NULL,'TEXT',NULL,'Why a column was left out. Recording exclusions with their reason is what turns a decision into an auditable decision.'),

-- ==================== ml_model_artifacts ====================
('ml_model_artifacts','model_id','Model','IDENTITY',NULL,'INTEGER',NULL,'Foreign key to ml_models; one artefact per model.'),
('ml_model_artifacts','artifact_bytes','Artifact bytes','STORAGE',NULL,'BYTEA',NULL,'The serialised pipeline. Stored in the database rather than on disk so it is covered by the project backup routine, and in its own table so a light dump can exclude it.'),
('ml_model_artifacts','artifact_size_bytes','Artifact size','STORAGE','bytes','BIGINT',NULL,'Size of the serialised object.'),
('ml_model_artifacts','serialized_object','Serialised object','STORAGE',NULL,'TEXT',NULL,'Fully qualified class of what was serialised, e.g. sklearn.pipeline.Pipeline. Tells a reader whether the artefact includes preprocessing or only the estimator.'),
('ml_model_artifacts','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the artefact was stored.'),

-- ==================== kg_nodes ====================
('kg_nodes','node_type','Node type','IDENTITY',NULL,'TEXT',NULL,'Kind of entity the node represents, e.g. SAMPLE, LIGAND, MEASUREMENT.'),
('kg_nodes','label','Label','IDENTITY',NULL,'TEXT',NULL,'Display name of the node.'),
('kg_nodes','source_id','Source identifier','PROVENANCE',NULL,'TEXT',NULL,'Primary key of the originating row in source_table, so a graph node can always be traced back to its record.'),
('kg_nodes','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the node was built.'),

-- ==================== kg_edges ====================
('kg_edges','edge_id','Edge ID','IDENTITY',NULL,'BIGSERIAL',NULL,'Surrogate primary key.'),
('kg_edges','from_node','From node','IDENTITY',NULL,'TEXT',NULL,'Source node of the directed relation.'),
('kg_edges','to_node','To node','IDENTITY',NULL,'TEXT',NULL,'Target node of the directed relation.'),
('kg_edges','edge_type','Edge type','IDENTITY',NULL,'TEXT',NULL,'Kind of relation, e.g. USES_LIGAND or HAS_MEASUREMENT.'),
('kg_edges','properties','Properties','GOVERNANCE',NULL,'JSONB',NULL,'Extra metadata specific to the relation type.'),
('kg_edges','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the edge was built.'),

-- ==================== ai_agent_calls ====================
('ai_agent_calls','call_id','Call ID','IDENTITY',NULL,'BIGSERIAL',NULL,'Surrogate primary key.'),
('ai_agent_calls','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the call was made.'),
('ai_agent_calls','execution_id','Execution ID','TRACEABILITY',NULL,'TEXT',NULL,'Identifier of the n8n execution, so a call can be tied back to the run that made it.'),
('ai_agent_calls','agent_node','Agent node','TRACEABILITY',NULL,'TEXT',NULL,'Which node of the workflow issued the call.'),
('ai_agent_calls','sample_code','Sample code','TRACEABILITY',NULL,'TEXT',NULL,'Sample the call was about, when applicable.'),
('ai_agent_calls','technique','Technique','TRACEABILITY',NULL,'TEXT',NULL,'Characterisation technique involved, when applicable.'),
('ai_agent_calls','model_provider','Model provider','GOVERNANCE',NULL,'TEXT',NULL,'Provider of the language model used.'),
('ai_agent_calls','model_name','Model name','GOVERNANCE',NULL,'TEXT',NULL,'Exact model used, which matters because behaviour changes between versions.'),
('ai_agent_calls','is_fallback','Is fallback','GOVERNANCE',NULL,'BOOLEAN',NULL,'TRUE when a secondary model answered after the primary one failed.'),
('ai_agent_calls','success','Success','QUALITY',NULL,'BOOLEAN',NULL,'Whether the call returned a usable result.'),
('ai_agent_calls','error_message','Error message','QUALITY',NULL,'TEXT',NULL,'Error text when the call failed.'),
('ai_agent_calls','latency_ms','Latency','QUALITY','ms','INTEGER',NULL,'Round-trip time of the call.'),
('ai_agent_calls','confidence','Confidence','QUALITY',NULL,'NUMERIC',NULL,'Confidence reported by the agent, used by the human-in-the-loop gate to decide whether a person must review the output.'),

-- ==================== agent_owner_secret ====================
('agent_owner_secret','token_hash','Token hash','GOVERNANCE',NULL,'TEXT',NULL,'Hash of the owner token used to authorise privileged agent actions. Only the hash is stored, never the token itself.'),
('agent_owner_secret','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the token was issued.'),

-- ==================== job_leads ====================
('job_leads','lead_id','Lead ID','IDENTITY',NULL,'BIGSERIAL',NULL,'Surrogate primary key.'),
('job_leads','source_portal','Source portal','PROVENANCE',NULL,'TEXT',NULL,'Job board the offer came from.'),
('job_leads','job_title','Job title','GENERAL INFORMATION',NULL,'TEXT',NULL,'Title as published.'),
('job_leads','company_name','Company','GENERAL INFORMATION',NULL,'TEXT',NULL,'Hiring organisation.'),
('job_leads','location_text','Location','GENERAL INFORMATION',NULL,'TEXT',NULL,'Location as published, unnormalised.'),
('job_leads','job_url','Job URL','PROVENANCE',NULL,'TEXT',NULL,'Link to the original posting.'),
('job_leads','job_description','Job description','GENERAL INFORMATION',NULL,'TEXT',NULL,'Full text of the posting, kept because the source often disappears.'),
('job_leads','fit_reasoning','Fit reasoning','GOVERNANCE',NULL,'TEXT',NULL,'The evaluating agent explanation for its score, so the number can be judged rather than trusted.'),
('job_leads','recommendation','Recommendation','GOVERNANCE',NULL,'TEXT',NULL,'What the agent suggests doing with the offer.'),
('job_leads','cv_draft','CV draft','GOVERNANCE',NULL,'TEXT',NULL,'Draft CV produced by the agent, always subject to human review before use.'),
('job_leads','cover_letter_draft','Cover letter draft','GOVERNANCE',NULL,'TEXT',NULL,'Draft cover letter produced by the agent, always subject to human review before use.'),
('job_leads','reviewed_at','Reviewed at','GOVERNANCE',NULL,'TIMESTAMPTZ',NULL,'When a human reviewed the lead. NULL means still pending.'),
('job_leads','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the lead was captured.')

ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;

-- =============================================================================
-- (c) Las VISTAS.
--
-- Se documentan igual que las tablas, y por una razon concreta: son la
-- superficie que consultan los agentes y la futura aplicacion web. Un agente
-- que pregunta al diccionario por v_ml_features y no encuentra nada no puede
-- distinguir entre "sin documentar" y "no existe".
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES

-- ==================== v_ml_features: identidad y agrupamiento ====================
('v_ml_features','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample identifier. Never a model input: it is the key, not a feature.'),
('v_ml_features','hts_number','HTS plate','IDENTITY',NULL,'VARCHAR(20)',NULL,'Combinatorial plate the sample belongs to. Used ONLY as the grouping key in cross-validation: plates are internally homogeneous, so a random split would let a model recognise the plate instead of learning chemistry.'),
('v_ml_features','synthesis_date','Synthesis date','IDENTITY',NULL,'DATE',NULL,'Date of synthesis. Grouping and drift analysis only, never a model input.'),
('v_ml_features','metal_center','Metal centre','IDENTITY',NULL,'VARCHAR(20)',NULL,'Metal as free text. Present for grouping and traceability; the model consumes its properties instead, so that similar metals such as Zr and Hf can share learned behaviour.'),
('v_ml_features','linker','Linker','IDENTITY',NULL,'VARCHAR(100)',NULL,'Linker code as free text. Same reasoning as metal_center: the model consumes scaffold and protection_state, not the name.'),
('v_ml_features','metal_source','Metal source','IDENTITY',NULL,'VARCHAR(100)',NULL,'Precursor salt formula as recorded. The oxidation state is derived from it rather than assumed from the element.'),

-- ==================== v_ml_features: quimica del metal ====================
('v_ml_features','electronegativity_pauling','Electronegativity (Pauling)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Pauling electronegativity. Covers all 20 metals in use, which is why it is preferred over the Allen scale.'),
('v_ml_features','electronegativity_allen','Electronegativity (Allen)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Allen spectroscopic electronegativity. NULL for lanthanides because the scale is not defined for them; this is not a gap in the data but an absence in the scale, and the column is dropped before modelling.'),
('v_ml_features','absolute_hardness_ev','Absolute hardness','CHEMISTRY','eV','DOUBLE PRECISION',NULL,'Pearson hardness, eta = (IE1 - EA)/2. Basis of HSAB reasoning. NULL for Mg and Zn, whose filled shells give no measurable electron affinity.'),
('v_ml_features','oxophilicity_kepp','Oxophilicity (Kepp)','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Kepp 2016 oxophilicity scale. Directly relevant to phosphonate chemistry, since it measures affinity for oxygen donors. Permanently NULL for Ga, which the source table does not include.'),
('v_ml_features','polarizability_a3','Polarisability','CHEMISTRY','A^3','DOUBLE PRECISION',NULL,'Deformability of the electron cloud; the soft end of HSAB.'),
('v_ml_features','oxidation_state','Oxidation state','CHEMISTRY',NULL,'INTEGER',NULL,'Charge of the metal in the precursor as weighed, derived from the formula. Not the charge in the final MOF, which is unknown before synthesis.'),
('v_ml_features','shannon_radius_pm','Ionic radius','CHEMISTRY','pm','DOUBLE PRECISION',NULL,'Shannon effective ionic radius at CN=6. Together with the charge it sets the charge density, which turns out to be among the most informative features.'),
('v_ml_features','charge_over_radius','Charge density','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Oxidation state divided by ionic radius, an interpretable proxy for Lewis acidity. Governs how strongly the metal binds the phosphonate and therefore whether the system has time to order or precipitates amorphous.'),

-- ==================== v_ml_features: quimica del linker ====================
('v_ml_features','scaffold','Scaffold','CHEMISTRY',NULL,'VARCHAR(30)','triazine_phosphonate | pyrene_phosphonate | polyphenol | pyrene_bare','Chemical core shared by acid and ester pairs. One of the two independent axes hidden inside the linker names.'),
('v_ml_features','protection_state','Protection state','CHEMISTRY',NULL,'VARCHAR(20)','free_acid | ethyl_ester | none','Whether the acidic groups are free or protected as an ester. Esters are pro-linkers that must hydrolyse in situ before they can coordinate, so they behave differently from their free acids.'),
('v_ml_features','denticity','Denticity','CHEMISTRY',NULL,'INTEGER',NULL,'Number of donor sites. NULL where not well defined.'),
('v_ml_features','n_acidic_protons','Acidic protons','CHEMISTRY',NULL,'INTEGER',NULL,'Protons lost on coordination; the reason pH matters so much in this chemistry.'),
('v_ml_features','max_donor_distance_a','Max donor distance','CHEMISTRY','A','DOUBLE PRECISION',NULL,'Largest separation between donor atoms in an optimised conformer. Proxy for linker length and therefore for accessible pore size and topology.'),
('v_ml_features','n_rotatable_bonds','Rotatable bonds','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Conformational flexibility of the linker.'),

-- ==================== v_ml_features: proceso ====================
('v_ml_features','metal_conc_m','Metal concentration','THEORETICAL DESIGN','M','NUMERIC(10,4)','','Molar concentration of metal. Directly actionable: it is fixed when weighing.'),
('v_ml_features','lm_ratio','Ligand to metal ratio','THEORETICAL DESIGN',NULL,'NUMERIC(10,4)',NULL,'Theoretical molar ligand-to-metal ratio, the L/M column of the master spreadsheet. Range 0.1 to 1.0, median 0.50. Directly actionable.'),
('v_ml_features','temp_target_c','Target temperature','THERMAL RAMP','C','NUMERIC(6,2)',NULL,'Oven set point. Effectively discrete: about 13 distinct values across five years, because combinatorial campaigns fix the ramp and sweep composition.'),
('v_ml_features','time_hours','Reaction time','THERMAL RAMP','h','NUMERIC(6,2)',NULL,'Time at temperature. Also effectively discrete, about 9 distinct values.'),
('v_ml_features','heating_rate_c_min','Heating rate','THERMAL RAMP','C/min','NUMERIC(10,4)',NULL,'Rate of temperature rise, parsed from free-text ramp descriptions in the laboratory notebooks.'),
('v_ml_features','cooling_rate_c_min','Cooling rate','THERMAL RAMP','C/min','NUMERIC(10,4)',NULL,'Rate of cooling. Relevant because slow cooling favours thermodynamic phases over kinetic ones.'),
('v_ml_features','total_volume_ml','Total volume','SOLVENTS','mL','NUMERIC(12,4)',NULL,'Total liquid volume in the reactor, the denominator of every composition fraction.'),
('v_ml_features','reactor_volume_ml','Reactor volume','SOLVENTS','mL','NUMERIC(10,4)',NULL,'Nominal capacity of the vessel.'),
('v_ml_features','fill_fraction','Fill fraction','SOLVENTS',NULL,'NUMERIC',NULL,'Liquid volume over reactor volume. Governs the autogenous pressure that develops, which is not measured directly.'),

-- ==================== v_ml_features: composicion del medio ====================
('v_ml_features','frac_h2o','Water fraction','MEDIUM',NULL,'NUMERIC',NULL,'Water as a fraction of total volume. Fractions rather than millilitres so that two syntheses at different scales are comparable. NULL, never 0, when the breakdown does not account for the volume.'),
('v_ml_features','frac_meoh','Methanol fraction','MEDIUM',NULL,'NUMERIC',NULL,'Methanol as a fraction of total volume.'),
('v_ml_features','frac_etoh','Ethanol fraction','MEDIUM',NULL,'NUMERIC',NULL,'Ethanol as a fraction of total volume.'),
('v_ml_features','frac_proh','1-Propanol fraction','MEDIUM',NULL,'NUMERIC',NULL,'1-propanol as a fraction of total volume. Absent from the first version of this view, which left 208 syntheses with an invisible solvent.'),
('v_ml_features','frac_dmf','DMF fraction','MEDIUM',NULL,'NUMERIC',NULL,'Dimethylformamide as a fraction of total volume.'),
('v_ml_features','frac_def','DEF fraction','MEDIUM',NULL,'NUMERIC',NULL,'Diethylformamide as a fraction of total volume. Also absent from the first version of this view.'),

-- ==================== v_ml_features: moduladores ====================
('v_ml_features','mod_carboxylic_mmol','Carboxylic modulator','MODULATOR','mmol','NUMERIC',NULL,'Formic plus acetic plus propionic acid. Millimoles rather than microlitres, so molecular weight is already accounted for and the sum counts molecules.'),
('v_ml_features','mod_strong_acid_mmol','Strong acid modulator','MODULATOR','mmol','NUMERIC',NULL,'HCl plus TFA plus triflic plus methanesulfonic acid, grouped by pKa below 1. Until 2026-08-29 this column mixed millimoles with micromoles and the HCl contribution was numerically invisible.'),
('v_ml_features','mod_base_mmol','Basic modulator','MODULATOR','mmol','NUMERIC',NULL,'KOH plus triethylamine. Raises the degree of linker deprotonation, which is what allows it to coordinate.'),
('v_ml_features','mod_fluorinated_mmol','Fluorinated modulator','MODULATOR','mmol','NUMERIC',NULL,'HF plus TFA plus triflic acid. Fluorinated species act as mineralisers, altering crystal growth kinetics rather than just acidity.'),
('v_ml_features','mod_total_mmol','Total modulator','MODULATOR','mmol','NUMERIC',NULL,'Sum of all modulator families, as an overall dose measure.'),

-- ==================== v_ml_model_registry ====================
('v_ml_model_registry','model_id','Model ID','IDENTITY',NULL,'INTEGER',NULL,'Model identifier.'),
('v_ml_model_registry','model_slug','Model slug','IDENTITY',NULL,'VARCHAR(80)',NULL,'Stable readable identifier of the model.'),
('v_ml_model_registry','display_name','Display name','IDENTITY',NULL,'TEXT',NULL,'Human-readable model name.'),
('v_ml_model_registry','status','Status','GOVERNANCE',NULL,'VARCHAR(20)','active | superseded | archived | invalid','Lifecycle state. invalid means the results must not be used, even though the model once looked good.'),
('v_ml_model_registry','is_reproducible','Is reproducible','GOVERNANCE',NULL,'BOOLEAN',NULL,'Whether the model can be rebuilt today.'),
('v_ml_model_registry','algorithm','Algorithm','DESIGN',NULL,'VARCHAR(80)',NULL,'Estimator class.'),
('v_ml_model_registry','library','Library','REPRODUCIBILITY',NULL,'VARCHAR(40)',NULL,'Library that provided the estimator.'),
('v_ml_model_registry','created_on','Created on','PROVENANCE',NULL,'DATE',NULL,'Date the model was registered.'),
('v_ml_model_registry','dataset_slug','Dataset','REPRODUCIBILITY',NULL,'VARCHAR(80)',NULL,'Training snapshot the model was built on.'),
('v_ml_model_registry','n_rows','Rows','STATISTICS',NULL,'INTEGER',NULL,'Rows in the training snapshot.'),
('v_ml_model_registry','n_groups','Groups','STATISTICS',NULL,'INTEGER',NULL,'Validation groups. This, not the row count, is the effective sample size.'),
('v_ml_model_registry','f1_macro_cv','F1 macro (CV)','STATISTICS',NULL,'DOUBLE PRECISION',NULL,'Cross-validated macro F1, the headline metric. Weights all three classes equally, so ignoring the rare crystalline class is heavily penalised.'),
('v_ml_model_registry','mcc_cv','MCC (CV)','STATISTICS',NULL,'DOUBLE PRECISION',NULL,'Matthews correlation coefficient. The strictest of the metrics used: zero means chance, however high the raw accuracy.'),
('v_ml_model_registry','has_artifact','Has artefact','STORAGE',NULL,'BOOLEAN',NULL,'Whether a serialised binary is stored. FALSE for models kept only as a record, such as those whose training data no longer exists.'),
('v_ml_model_registry','artifact_size','Artefact size','STORAGE',NULL,'TEXT',NULL,'Human-readable size of the stored binary.'),
('v_ml_model_registry','git_commit','Git commit','REPRODUCIBILITY',NULL,'VARCHAR(50)',NULL,'Repository commit at training time, with a dirty suffix when the working tree had uncommitted changes.'),
('v_ml_model_registry','source_notebook','Source notebook','REPRODUCIBILITY',NULL,'TEXT',NULL,'Notebook or script that produced the model.'),
('v_ml_model_registry','notes','Notes','GOVERNANCE',NULL,'TEXT',NULL,'Why the model exists and what changed from its predecessor.'),

-- ==================== v_pxrd_labels_full ====================
('v_pxrd_labels_full','file_hash','File hash','IDENTITY',NULL,'VARCHAR(32)',NULL,'MD5 of the diffractogram file. The label is keyed on the file, not the sample, so relabelling survives re-ingestion.'),
('v_pxrd_labels_full','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample the labelled measurement belongs to.'),
('v_pxrd_labels_full','file_name','File name','IDENTITY',NULL,'VARCHAR(255)',NULL,'Original instrument file name.'),
('v_pxrd_labels_full','label_value','Label value','LABEL',NULL,'VARCHAR(40)','AMORFO | INCIPIENTE | CRISTALINO | MEZCLA | SIN_MUESTRA','Expert judgement on the diffractogram. This is the ground truth of the whole machine-learning effort and is derivable from no file.'),
('v_pxrd_labels_full','confidence','Confidence','LABEL',NULL,'VARCHAR(20)',NULL,'How sure the expert was, so uncertain calls can be revisited first.'),
('v_pxrd_labels_full','notes','Notes','LABEL',NULL,'TEXT',NULL,'Free-text reasoning recorded at labelling time.'),
('v_pxrd_labels_full','labeled_by','Labelled by','TRACEABILITY',NULL,'VARCHAR(100)',NULL,'Who or what produced the label.'),
('v_pxrd_labels_full','labeled_at','Labelled at','TRACEABILITY',NULL,'TIMESTAMPTZ',NULL,'When the label was first written.'),
('v_pxrd_labels_full','updated_at','Updated at','TRACEABILITY',NULL,'TIMESTAMPTZ',NULL,'When the label was last changed.'),
('v_pxrd_labels_full','metal_center','Metal centre','CHEMISTRY',NULL,'VARCHAR(20)',NULL,'Metal of the parent synthesis, joined in for context while labelling.'),
('v_pxrd_labels_full','linker','Linker','CHEMISTRY',NULL,'VARCHAR(100)',NULL,'Linker of the parent synthesis, joined in for context.'),
('v_pxrd_labels_full','temp_target_c','Target temperature','THERMAL RAMP','C','NUMERIC(6,2)',NULL,'Synthesis temperature, joined in for context.'),
('v_pxrd_labels_full','time_hours','Reaction time','THERMAL RAMP','h','NUMERIC(6,2)',NULL,'Synthesis time, joined in for context.'),
('v_pxrd_labels_full','needs_relink','Needs relink','QUALITY',NULL,'BOOLEAN',NULL,'TRUE when the label has lost its link to a measurement row, typically after a deletion. Flags work to be redone rather than letting the orphan pass unnoticed.'),

-- ==================== v_agent_samples / v_agente_muestras ====================
('v_agent_samples','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample identifier.'),
('v_agent_samples','synthesis_date','Synthesis date','GENERAL INFORMATION',NULL,'DATE',NULL,'Date of synthesis.'),
('v_agent_samples','researcher_name','Researcher','GENERAL INFORMATION',NULL,'VARCHAR(100)',NULL,'Who performed the synthesis.'),
('v_agent_samples','metal_center','Metal centre','CHEMISTRY',NULL,'VARCHAR(20)',NULL,'Metal used.'),
('v_agent_samples','linker','Linker','CHEMISTRY',NULL,'VARCHAR(100)',NULL,'Linker used.'),
('v_agent_samples','n_tecnicas','Technique count','CHARACTERIZATION',NULL,'BIGINT',NULL,'How many distinct characterisation techniques exist for the sample. Lets an agent answer how well characterised a sample is without scanning the measurement table.'),
('v_agent_samples','tecnicas','Techniques','CHARACTERIZATION',NULL,'VARCHAR[]',NULL,'Array of technique codes available for the sample.'),
('v_agente_muestras','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Sample identifier. Spanish-named twin of v_agent_samples, kept so agents can be addressed in either language.'),
('v_agente_muestras','synthesis_date','Synthesis date','GENERAL INFORMATION',NULL,'DATE',NULL,'Date of synthesis.'),
('v_agente_muestras','researcher_name','Researcher','GENERAL INFORMATION',NULL,'VARCHAR(100)',NULL,'Who performed the synthesis.'),
('v_agente_muestras','metal_center','Metal centre','CHEMISTRY',NULL,'VARCHAR(20)',NULL,'Metal used.'),
('v_agente_muestras','linker','Linker','CHEMISTRY',NULL,'VARCHAR(100)',NULL,'Linker used.'),
('v_agente_muestras','n_tecnicas','Technique count','CHARACTERIZATION',NULL,'BIGINT',NULL,'How many distinct characterisation techniques exist for the sample.'),
('v_agente_muestras','tecnicas','Techniques','CHARACTERIZATION',NULL,'VARCHAR[]',NULL,'Array of technique codes available for the sample.'),

-- ==================== v_rag_library / v_rag_biblioteca ====================
('v_rag_library','document_id','Document ID','IDENTITY',NULL,'BIGINT',NULL,'Document identifier in the RAG corpus.'),
('v_rag_library','file_name','File name','IDENTITY',NULL,'TEXT',NULL,'Source file name.'),
('v_rag_library','doc_type','Document type','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Kind of document, e.g. article, thesis, internal note.'),
('v_rag_library','sensitivity','Sensitivity','GOVERNANCE',NULL,'TEXT',NULL,'Confidentiality level. Gates what may be sent to an external model, since raw synthesis parameters and ligand names must never leave the system unmasked.'),
('v_rag_library','title','Title','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Document title.'),
('v_rag_library','authors','Authors','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Authors of the document.'),
('v_rag_library','year','Year','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Publication year.'),
('v_rag_library','journal','Journal','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Journal or venue.'),
('v_rag_library','doi','DOI','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Digital object identifier, so a retrieved passage can be cited precisely.'),
('v_rag_library','n_chunks','Chunk count','RAG - CHUNKS',NULL,'INTEGER',NULL,'How many retrievable chunks the document was split into.'),
('v_rag_library','n_pages','Page count','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Pages in the source document.'),
('v_rag_library','n_images','Image count','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Images extracted from the document.'),
('v_rag_library','parent_document_id','Parent document','RAG - DOCUMENTS',NULL,'BIGINT',NULL,'Parent document when this one is supporting information, so a fragment can be traced to the main article.'),
('v_rag_library','parent_title','Parent title','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Title of the parent document.'),
('v_rag_library','parent_doi','Parent DOI','RAG - DOCUMENTS',NULL,'TEXT',NULL,'DOI of the parent document.'),
('v_rag_library','cita','Citation','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Preassembled citation string, so an agent can cite its source without composing one.'),
('v_rag_biblioteca','document_id','Document ID','IDENTITY',NULL,'BIGINT',NULL,'Document identifier. Spanish-named twin of v_rag_library.'),
('v_rag_biblioteca','file_name','File name','IDENTITY',NULL,'TEXT',NULL,'Source file name.'),
('v_rag_biblioteca','doc_type','Document type','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Kind of document.'),
('v_rag_biblioteca','sensitivity','Sensitivity','GOVERNANCE',NULL,'TEXT',NULL,'Confidentiality level, gating what may be sent to an external model.'),
('v_rag_biblioteca','title','Title','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Document title.'),
('v_rag_biblioteca','authors','Authors','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Authors of the document.'),
('v_rag_biblioteca','year','Year','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Publication year.'),
('v_rag_biblioteca','journal','Journal','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Journal or venue.'),
('v_rag_biblioteca','doi','DOI','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Digital object identifier.'),
('v_rag_biblioteca','n_chunks','Chunk count','RAG - CHUNKS',NULL,'INTEGER',NULL,'Number of retrievable chunks.'),
('v_rag_biblioteca','n_pages','Page count','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Pages in the source document.'),
('v_rag_biblioteca','n_images','Image count','RAG - DOCUMENTS',NULL,'INTEGER',NULL,'Images extracted.'),
('v_rag_biblioteca','parent_document_id','Parent document','RAG - DOCUMENTS',NULL,'BIGINT',NULL,'Parent document for supporting information.'),
('v_rag_biblioteca','parent_title','Parent title','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Title of the parent document.'),
('v_rag_biblioteca','parent_doi','Parent DOI','RAG - DOCUMENTS',NULL,'TEXT',NULL,'DOI of the parent document.'),
('v_rag_biblioteca','cita','Citation','RAG - DOCUMENTS',NULL,'TEXT',NULL,'Preassembled citation string.'),

-- ==================== characterization_measurements_test ====================
-- Tabla de pruebas del pipeline de ingesta. Se documenta igual que el resto
-- porque existe: un diccionario que omite objetos reales induce a error.
('characterization_measurements_test','measurement_id','Measurement ID','IDENTITY',NULL,'UUID',NULL,'Primary key. Test twin of characterization_measurements, used to exercise the ingestion pipeline without touching real data.'),
('characterization_measurements_test','researcher_name','Researcher','GENERAL INFORMATION',NULL,'VARCHAR(100)',NULL,'Researcher who submitted the file.'),
('characterization_measurements_test','researcher_email','Researcher email','GOVERNANCE',NULL,'VARCHAR(255)',NULL,'Submitter email, checked against the authorised whitelist.'),
('characterization_measurements_test','operator_name','Operator','GENERAL INFORMATION',NULL,'VARCHAR(100)',NULL,'Instrument operator.'),
('characterization_measurements_test','instrument_name','Instrument','GENERAL INFORMATION',NULL,'VARCHAR(100)',NULL,'Instrument that produced the file.'),
('characterization_measurements_test','file_name','File name','TRACEABILITY',NULL,'VARCHAR(255)',NULL,'Original file name.'),
('characterization_measurements_test','file_hash','File hash','QUALITY',NULL,'VARCHAR(32)',NULL,'MD5 of the file contents, the anti-duplication gate.'),
('characterization_measurements_test','created_at','Created at','PROVENANCE',NULL,'TIMESTAMPTZ',NULL,'When the row was ingested.')

ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;


-- =============================================================================
-- (d) COMMENT ON TABLE en los objetos que no lo tenian.
--
-- data_dictionary y los COMMENT nativos son dos capas de la misma
-- documentacion: el primero es consultable por agentes y por la aplicacion
-- web; los segundos hacen que pgAdmin se explique solo. Conviene que ambas
-- existan, y src/sync_data_dictionary.py comprueba que no se contradigan.
-- =============================================================================
COMMENT ON TABLE synthesis_experiments IS
    'Tabla padre del proyecto: una fila por sintesis intentada, con la clave primaria sample_code. Reune el diseno teorico, los disolventes, la rampa termica y los moduladores de cinco anos de libretas de laboratorio. Se escribe por UPSERT desde el cuaderno 01, nunca por DELETE, para no borrar filas que haya creado n8n.';

COMMENT ON TABLE data_dictionary IS
    'La documentacion del esquema como filas consultables: una por columna de cada tabla y vista. Existe para que la aplicacion web y los agentes de IA lean el diccionario DESDE la base en vez de llevarlo escrito en el codigo. Su cobertura debe ser del 100 %: un diccionario incompleto no permite distinguir entre una columna sin documentar y una columna que no existe.';

COMMENT ON TABLE characterization_measurements_test IS
    'Copia de pruebas de characterization_measurements, para ejercitar el pipeline de ingesta sin tocar datos reales. No forma parte del flujo de produccion.';

COMMENT ON VIEW v_ml_model_registry IS
    'El registro de modelos en forma legible, sin los binarios: que modelos hay, sobre que datos, con que resultado y si siguen siendo reproducibles.';

-- =============================================================================
-- (e) Las 20 columnas que SI tenian COMMENT nativo pero no llegaron al
--     diccionario. Se escriben a mano en vez de importarlas automaticamente,
--     para que lleven section_name real y no queden como UNCLASSIFIED.
-- =============================================================================
INSERT INTO data_dictionary
    (table_name, column_name, full_name, section_name, unit, data_type, valid_categories, description) VALUES

-- ==================== characterization_measurements_test ====================
('characterization_measurements_test','sample_code','Sample code','IDENTITY',NULL,'VARCHAR(50)',NULL,'Foreign key to synthesis_experiments.sample_code. Test twin of the production column.'),
('characterization_measurements_test','technique','Technique','CHARACTERIZATION',NULL,'VARCHAR(30)','PXRD | VT-XRD | TGA | FTIR | UV_VIS | BET_N2 | SEM | ICP | EA','Characterisation technique code.'),
('characterization_measurements_test','measurement_tag','Measurement tag','CHARACTERIZATION',NULL,'VARCHAR(100)',NULL,'Condition under which the measurement was taken, e.g. as_synthesized or activated_150C. Distinguishes repeat measurements of one sample.'),
('characterization_measurements_test','raw_file_path','Raw file path','TRACEABILITY',NULL,'TEXT',NULL,'Path to the unparsed file in the data lake, so any parsed value can be traced back to the instrument output.'),
('characterization_measurements_test','data_json','Parsed payload','CHARACTERIZATION',NULL,'JSONB',NULL,'Parsed content following the common parser contract: a header_metadata dict plus a raw_data dict with x_label, y_label and the curve arrays. The uniform shape is what lets agents query any technique the same way.'),

-- ==================== element_properties ====================
('element_properties','absolute_electroneg_ev','Absolute electronegativity','CHEMISTRY','eV','DOUBLE PRECISION',NULL,'Mulliken/Pearson absolute electronegativity, chi = (IE1 + EA)/2. Paired with absolute hardness in HSAB reasoning.'),
('element_properties','data_source','Data source','PROVENANCE',NULL,'VARCHAR(50)',NULL,'Which tool or table produced the row, e.g. mendeleev+pymatgen or manual_kepp_2016. Separates computed values from hand-entered ones.'),

-- ==================== ion_properties ====================
('ion_properties','charge_over_radius','Charge density','CHEMISTRY',NULL,'DOUBLE PRECISION',NULL,'Oxidation state divided by Shannon radius: a cheap, interpretable proxy for charge density and Lewis acidity.'),

-- ==================== job_leads ====================
('job_leads','source_email_id','Source email ID','PROVENANCE',NULL,'TEXT',NULL,'Message-ID of the originating email. Not unique on its own, since one email can carry several offers.'),
('job_leads','fit_score','Fit score','GOVERNANCE',NULL,'INTEGER',NULL,'Score from 0 to 100 given by the evaluating agent, comparing the offer against the profile. Always read alongside fit_reasoning: a score without its reasoning cannot be judged.'),
('job_leads','status','Status','GOVERNANCE',NULL,'TEXT','PENDIENTE_REVISION | others set by hand','Lifecycle state. PENDIENTE_REVISION is the only value the automated flow writes; every other state requires a human, which is what keeps the agent from acting on its own judgement.'),

-- ==================== kg_edges ====================
('kg_edges','confidence','Confidence','QUALITY',NULL,'NUMERIC(4,3)',NULL,'Always 1.0 for deterministic edges. For LLM-inferred edges it is the model self-reported confidence, and must never be read as a probability.'),
('kg_edges','source','Source','PROVENANCE',NULL,'TEXT','DETERMINISTIC | LLM_INFERRED','How the edge was created. DETERMINISTIC means it was built from a real column by build_knowledge_graph.py; LLM_INFERRED means a model proposed it. Keeping the two apart is what stops inferred relations from hardening into facts.'),
('kg_edges','review_status','Review status','GOVERNANCE',NULL,'TEXT','CONFIRMED | PENDING | REJECTED','Deterministic edges are born CONFIRMED; LLM-inferred ones are born PENDING and need a human to confirm them.'),

-- ==================== kg_nodes ====================
('kg_nodes','node_id','Node ID','IDENTITY',NULL,'TEXT',NULL,'Readable key prefixed by type, e.g. SAMPLE:SMP-0010 or LIGAND:H2BDC. Readable on purpose, so a graph query can be understood without a lookup table.'),
('kg_nodes','source_table','Source table','PROVENANCE',NULL,'TEXT',NULL,'Table the node came from when it maps to a real row, e.g. synthesis_experiments. NULL for nodes that are pure concepts.'),
('kg_nodes','properties','Properties','GOVERNANCE',NULL,'JSONB',NULL,'Extra metadata specific to the node type, e.g. n_files on a MEASUREMENT node.'),

-- ==================== ml_datasets ====================
('ml_datasets','known_caveats','Known caveats','GOVERNANCE',NULL,'TEXT',NULL,'What a reader must know before reusing the snapshot: known biases, doubtful columns, declared gaps. Writing these down at registration time is what stops a dataset from being reused blindly later.'),

-- ==================== ml_model_artifacts ====================
('ml_model_artifacts','load_instructions','Load instructions','STORAGE',NULL,'TEXT',NULL,'How to load the artefact, written out literally. A binary without loading instructions is a guaranteed future problem.'),

-- ==================== ml_models ====================
('ml_models','git_commit','Git commit','REPRODUCIBILITY',NULL,'VARCHAR(50)',NULL,'Repository commit at training time, with a -dirty suffix when the working tree had uncommitted changes. Without it there is no way to know which code produced the model, however many hyperparameters are stored.')

ON CONFLICT (table_name, column_name) DO UPDATE SET
    full_name = EXCLUDED.full_name, section_name = EXCLUDED.section_name,
    unit = EXCLUDED.unit, data_type = EXCLUDED.data_type,
    valid_categories = EXCLUDED.valid_categories, description = EXCLUDED.description;
