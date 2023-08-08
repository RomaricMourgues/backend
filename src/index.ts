import framework from "./platform";
import services from "./services";

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

export const start = async () => {
  await framework.init();
  await services.init();
};

export const stop = async () => {
  if (services.internalServer) services.internalServer.close();
  //Wait 1s
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

if (process.env.JEST !== "1") {
  start();
}
