import { cloudbaseTemplateConfig } from './config/index.js';

App({
  onLaunch() {
    if (wx.cloud) {
      if (!cloudbaseTemplateConfig.envId) {
        console.warn('[cloud] 请先配置云开发环境ID：config/index.js 的 cloudbaseTemplateConfig.envId');
        return;
      }
      wx.cloud.init({
        env: cloudbaseTemplateConfig.envId,
        traceUser: true,
      });
    }
  },
});
