--
-- PostgreSQL database dump
--

\restrict auqsFRCfMp3ueGnckhEMI8KqhgTcNUMhnYOKTyuukeXQUud1zHf1uxoqf20sdy9

-- Dumped from database version 15.15 (Homebrew)
-- Dumped by pg_dump version 15.15 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: rvn_roi_finance_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rvn_roi_finance_links (
    link_id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    organization_id text NOT NULL,
    finance_artifact_type text NOT NULL,
    finance_artifact_id text NOT NULL,
    finance_version_id text NOT NULL,
    mapping_version integer DEFAULT 1 NOT NULL,
    source text NOT NULL,
    as_of timestamp with time zone NOT NULL,
    semantic_unit text,
    currency text,
    link_purpose text NOT NULL,
    linked_by text NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rvn_roi_finance_links OWNER TO postgres;

--
-- Name: rvn_roi_finance_reconciliations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rvn_roi_finance_reconciliations (
    reconciliation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    organization_id text NOT NULL,
    finance_link_id uuid NOT NULL,
    roi_value numeric NOT NULL,
    finance_value numeric NOT NULL,
    divergence_reason text,
    status text DEFAULT 'open'::text NOT NULL,
    opened_by text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by text,
    resolved_at timestamp with time zone,
    resolution_notes text,
    row_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT rvn_roi_finance_reconciliations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text, 'accepted_divergence'::text])))
);


ALTER TABLE public.rvn_roi_finance_reconciliations OWNER TO postgres;

--
-- Name: rvn_roi_finance_links rvn_roi_finance_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rvn_roi_finance_links
    ADD CONSTRAINT rvn_roi_finance_links_pkey PRIMARY KEY (link_id);


--
-- Name: rvn_roi_finance_reconciliations rvn_roi_finance_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rvn_roi_finance_reconciliations
    ADD CONSTRAINT rvn_roi_finance_reconciliations_pkey PRIMARY KEY (reconciliation_id);


--
-- Name: idx_rvn_roi_finance_links_case; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rvn_roi_finance_links_case ON public.rvn_roi_finance_links USING btree (organization_id, case_id);


--
-- Name: idx_rvn_roi_finance_reconciliations_case; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rvn_roi_finance_reconciliations_case ON public.rvn_roi_finance_reconciliations USING btree (organization_id, case_id, opened_at DESC);


--
-- Name: rvn_roi_finance_links rvn_roi_finance_links_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rvn_roi_finance_links
    ADD CONSTRAINT rvn_roi_finance_links_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.rvn_roi_cases(case_id);


--
-- Name: rvn_roi_finance_reconciliations rvn_roi_finance_reconciliations_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rvn_roi_finance_reconciliations
    ADD CONSTRAINT rvn_roi_finance_reconciliations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.rvn_roi_cases(case_id);


--
-- Name: rvn_roi_finance_reconciliations rvn_roi_finance_reconciliations_finance_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rvn_roi_finance_reconciliations
    ADD CONSTRAINT rvn_roi_finance_reconciliations_finance_link_id_fkey FOREIGN KEY (finance_link_id) REFERENCES public.rvn_roi_finance_links(link_id);


--
-- PostgreSQL database dump complete
--

\unrestrict auqsFRCfMp3ueGnckhEMI8KqhgTcNUMhnYOKTyuukeXQUud1zHf1uxoqf20sdy9

