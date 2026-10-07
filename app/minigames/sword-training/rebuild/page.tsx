import SwordTrainingClientGame from "@/components/minigames/sword-training/SwordTrainingClientGame";
// Compatibility URL for earlier verification links; the main route now uses
// this same source-client implementation.
export default function SwordTrainingRebuildPreview() {
    return <SwordTrainingClientGame />;
}
