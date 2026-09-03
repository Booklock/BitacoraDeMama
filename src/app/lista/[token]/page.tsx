import { ListaRegalos } from '@/components/ListaRegalos';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Lista de regalos · Bitácora de Mamá',
  description: 'Lo que todavía falta para la llegada del bebé.',
};

export default async function ListaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ListaRegalos token={token} />;
}
