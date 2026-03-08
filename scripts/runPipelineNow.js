require("dotenv").config();

const { runPipeline } = require("../server/pipeline/orchestrator");

(async () => {
  try {
    const snapshot = await runPipeline({ trigger: "cli" });
    console.log("Pipeline completed");
    console.log("Date:", snapshot.date);
    console.log("Generated:", snapshot.generatedAt);
    console.log(
      "Scores:",
      snapshot.scores.map((x) => `${x.name}: ${x.score}`).join(" | "),
    );
    console.log("Alerts:", snapshot.alerts.length);
    process.exit(0);
  } catch (error) {
    console.error("Pipeline failed:", error.message);
    process.exit(1);
  }
})();
