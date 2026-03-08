const cron = require("node-cron");

function startScheduler(runPipeline) {
  const timezone = process.env.TZ || "America/Chicago";

  const task = cron.schedule(
    "0 2 * * *",
    async () => {
      try {
        await runPipeline({ trigger: "cron-2am" });
      } catch (error) {
        console.error("[scheduler] pipeline run failed:", error.message);
      }
    },
    { timezone },
  );

  return task;
}

module.exports = {
  startScheduler,
};
