// ─────────────────────────────────────────────────────────────
// withPodDeploymentTarget — config plugin that injects a
// per-pod IPHONEOS_DEPLOYMENT_TARGET override into Podfile's
// post_install hook.
//
// Why: expo-build-properties' deploymentTarget option only sets
// the app target's iOS minimum, NOT individual pods. Some Expo
// SDK 55 pods (e.g. ExpoFileSystem) declare iOS 15.0 in their
// .podspec, conflicting with ExpoModulesCore's 15.1 minimum and
// failing the build with:
//
//   "compiling for iOS 15.0, but module 'ExpoModulesCore' has a
//    minimum deployment target of iOS 15.1"
//
// This is the standard CocoaPods workaround in pre-Expo RN apps;
// expo-build-properties was supposed to absorb it but doesn't.
// Filed as a feature request elsewhere; for now we own this.
//
// Usage in app.json:
//   "plugins": [
//     ...,
//     ["./plugins/withPodDeploymentTarget", { "deploymentTarget": "15.1" }]
//   ]
// ─────────────────────────────────────────────────────────────

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SENTINEL = '# withPodDeploymentTarget injected';

module.exports = function withPodDeploymentTarget(
  config,
  { deploymentTarget = '15.1' } = {},
) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent: if we already injected, leave the file alone.
      if (contents.includes(SENTINEL)) {
        return cfg;
      }

      const hook = `
    ${SENTINEL} (target=${deploymentTarget})
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
      end
    end`;

      // Find the existing post_install block's closing `end\nend`
      // and inject before it. This appends to the hook react-native
      // already populates rather than replacing it — RN's
      // react_native_post_install must still run.
      const re = /(post_install do \|installer\|[\s\S]*?)(\n  end\nend\s*$)/;
      if (!re.test(contents)) {
        throw new Error(
          '[withPodDeploymentTarget] post_install hook not found in Podfile — Expo prebuild output may have changed shape; update the regex.',
        );
      }
      contents = contents.replace(re, `$1${hook}$2`);

      fs.writeFileSync(podfilePath, contents, 'utf8');
      return cfg;
    },
  ]);
};
