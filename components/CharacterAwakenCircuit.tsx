import { deploymentUrl } from "@/lib/deployment";
import styles from "./CharacterAwakenCircuit.module.css";
const awakenBackgroundImageMap: Record<string, string> = {
    SR: deploymentUrl("/unit/unit_bg/UNIT_SLOT_CONTRACT_FX_BG_SR_AWAKEN.png"),
    SSR: deploymentUrl("/unit/unit_bg/UNIT_SLOT_CONTRACT_FX_BG_SSR_AWAKEN.png"),
};
type CharacterAwakenCircuitProps = {
    grade: string;
    isAwakened: boolean;
};
export default function CharacterAwakenCircuit({ grade, isAwakened, }: CharacterAwakenCircuitProps) {
    const backgroundImagePath = isAwakened
        ? (awakenBackgroundImageMap[grade] ?? "")
        : "";
    if (!backgroundImagePath) {
        return null;
    }
    return (<div className={`${styles.mirror} pointer-events-none absolute inset-0 z-0 overflow-hidden`} aria-hidden="true">
      <div className={styles.plane}>
        <span className={styles.texture} style={{ backgroundImage: `url(${backgroundImagePath})` }}/>
      </div>
    </div>);
}
