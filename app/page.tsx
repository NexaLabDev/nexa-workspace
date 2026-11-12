// ============================================
// PÁGINA INICIAL — Painel Nexa Workspace
// ============================================
// O painel antigo (MUI) continua em /painel-antigo.

import DashboardNexa from '@/components/dashboard-nexa/DashboardNexa';

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Home() {
  return <AreaPrivada><DashboardNexa /></AreaPrivada>;
}
