/**
 * „Graf wiedzy" — JEDENASTY realny ekran redesignu v1 (etap B), ostatni z
 * dziesięciu przełożonych w tym kroku.
 *
 * Ekran samodzielny (§4 dokumentu konsolidacji, pozycja #20 „zostaje jako
 * widok wtórny") — bez zmian treści, montuje ten sam `KnowledgeGraphExplorer`
 * co legacy trasa `/organization/sources/knowledge-graph`
 * (React Flow + `Api.kg*`). Jedyna zmiana: naprawiony przy okazji jeden
 * crimson focus-ring (`focus:ring-primary-500/30` → `focus:ring-[var(--c-focus)]`
 * w polu wyszukiwania encji — CLAUDE.md „fokus = niebieski c-focus").
 *
 * Ekran potrzebuje pełnej szerokości (graf, panel encji, minimapa) — w
 * `OrganizationView` renderowany BEZ prawego panelu stanu (`statePanel: null`),
 * zgodnie z uzasadnieniem w `OrganizationScreenShell`.
 */

import React from 'react';

import { KnowledgeGraphExplorer } from '../KnowledgeGraphExplorer';

export const OrganizationKnowledgeGraphScreen: React.FC = () => <KnowledgeGraphExplorer />;

export default OrganizationKnowledgeGraphScreen;
