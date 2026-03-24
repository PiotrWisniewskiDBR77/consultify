import { VectorHero } from "@/components/sections/vector/VectorHero";
import { VectorIntro } from "@/components/sections/vector/VectorIntro";
import { VectorTrustBar } from "@/components/sections/vector/VectorTrustBar";
import { VectorHowBuilt } from "@/components/sections/vector/VectorHowBuilt";
import { VectorAIPreview } from "@/components/sections/vector/VectorAIPreview";
import { VectorBento } from "@/components/sections/vector/VectorBento";
import { VectorArchitecture } from "@/components/sections/vector/VectorArchitecture";
import { VectorStats } from "@/components/sections/vector/VectorStats";
import { VectorSecurityHighlights } from "@/components/sections/vector/VectorSecurityHighlights";
import { VectorComparison } from "@/components/sections/vector/VectorComparison";
import { VectorByRole } from "@/components/sections/vector/VectorByRole";
import { VectorFAQ } from "@/components/sections/vector/VectorFAQ";
import { VectorFinalCTA } from "@/components/sections/vector/VectorFinalCTA";

export default function VectorPage() {
  return (
    <>
      <VectorHero />
      <VectorIntro />
      <VectorTrustBar />
      <VectorHowBuilt />
      <VectorAIPreview />
      <VectorBento />
      <VectorArchitecture />
      <VectorStats />
      <VectorSecurityHighlights />
      <VectorComparison />
      <VectorByRole />
      <VectorFAQ />
      <VectorFinalCTA />
    </>
  );
}
