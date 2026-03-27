import pc from 'picocolors';

const SIGMA_ART = `
        ██████╗
      ██╔═══█████████▶
    ██╔╝      ╚███╗
   ██╔╝        ╚██║
   ██║          ██║
   ██║         ██╔╝
    ██╗      ╔██╔╝
     ╚████████╔╝
       ╚═════╝
`;

const LOGO_TEXT = `  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
  ┃  sigma.money CLI  v1.1.0      ┃
  ┃  DeFi on BNB Chain            ┃
  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

export function printBanner(): void {
  const lines = SIGMA_ART.split('\n');
  const colored = lines.map((line) => {
    // Gradient: yellow at top → red/magenta at bottom to mimic the orange gradient
    const idx = lines.indexOf(line);
    const ratio = idx / (lines.length - 1);
    if (ratio < 0.4) return pc.yellow(line);
    if (ratio < 0.7) return pc.red(line);        // orange-ish in most terminals
    return pc.magenta(line);
  });
  console.log(colored.join('\n'));
  console.log(pc.yellow(LOGO_TEXT));
  console.log();
}
