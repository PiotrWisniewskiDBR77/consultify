export const createAssessmentAnalysis = () => ({
    generateGapSummary: (assessment) => {
        const gaps = (assessment.axisScores || [])
            .map(s => ({ axis: s.axis, gap: s.toBe - s.asIs }))
            .sort((a, b) => b.gap - a.gap);

        const prioritized = gaps.filter(g => g.gap > 2).map(g => g.axis);

        return {
            prioritizedGaps: prioritized,
            gapAnalysisSummary: prioritized.length > 0
                ? `Focus areas with significant gaps: ${prioritized.join(', ')}`
                : 'No critical gaps detected. Proceed to initiative planning.'
        };
    }
});
