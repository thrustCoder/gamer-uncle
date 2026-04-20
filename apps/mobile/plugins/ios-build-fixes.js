// Config plugin to fix iOS build issues:
// 1. Forces minimum deployment target on all pods (fixes RNCAsyncStorage 9.0 warning)
// 2. Patches fmt base.h to disable consteval (fixes C++ compilation errors with newer Xcode)

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PODFILE_SNIPPET = `
    # [ios-build-fixes] Force minimum deployment target and patch fmt consteval
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end

    # Patch fmt/base.h to disable consteval (broken in newer Xcode)
    fmt_base = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('ios-build-fixes patched')
        File.chmod(0644, fmt_base)
        content.sub!(
          '// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated.',
          "// [ios-build-fixes patched] Force disable consteval\\n" \\
          "#undef FMT_USE_CONSTEVAL\\n" \\
          "#define FMT_USE_CONSTEVAL 0\\n" \\
          "#if 0 // Original consteval detection disabled\\n" \\
          "// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated."
        )
        content.sub!(
          "#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval",
          "#endif // end disabled detection\\n#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval"
        )
        File.write(fmt_base, content)
      end
    end
`;

function iosBuildFixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosDir, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = '# [ios-build-fixes]';
      if (!podfile.includes(marker)) {
        podfile = podfile.replace(
          /^(  end\nend)\s*$/m,
          PODFILE_SNIPPET + '  end\nend\n'
        );
      }

      fs.writeFileSync(podfilePath, podfile, 'utf8');

      // Patch fmt/base.h after pod install to force FMT_USE_CONSTEVAL=0
      const fmtBasePath = path.join(iosDir, 'Pods', 'fmt', 'include', 'fmt', 'base.h');
      if (fs.existsSync(fmtBasePath)) {
        patchFmtBase(fmtBasePath);
      }

      return config;
    },
  ]);
}

function patchFmtBase(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('// [ios-build-fixes patched]')) return;

  // Replace the consteval detection block: force FMT_USE_CONSTEVAL to 0
  content = content.replace(
    /\/\/ Detect consteval, C\+\+20 constexpr extensions and std::is_constant_evaluated\.\n(#[\s\S]*?)#if FMT_USE_CONSTEVAL\n/m,
    '// [ios-build-fixes patched] Force disable consteval for Xcode compatibility\n' +
    '#define FMT_USE_CONSTEVAL 0\n' +
    '#if FMT_USE_CONSTEVAL\n'
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

module.exports = iosBuildFixes;
