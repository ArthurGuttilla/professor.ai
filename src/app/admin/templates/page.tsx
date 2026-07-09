import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { saveSlideTemplateAction } from "@/app/admin/actions";
import { Button, Card, Input, Label, PageTitle } from "@/components/ui";

type SlideConfig = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  coverText?: string;
  closingText?: string;
  logoUrl?: string;
};

export default async function TemplatesPage() {
  const admin = await requireAdmin();
  const template = await prisma.institutionTemplate.findFirst({
    where: { institutionId: admin.institutionId, kind: "SLIDES" },
  });
  const cfg = (template?.config as SlideConfig | null) ?? {};

  return (
    <div>
      <PageTitle sub="Identidade visual aplicada aos decks de slides gerados (M4).">
        Template institucional de slides
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <form action={saveSlideTemplateAction} className="space-y-3">
            <div>
              <Label>Nome do template</Label>
              <Input name="name" defaultValue={template?.name ?? "Template institucional"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cor primária</Label>
                <Input name="primaryColor" type="color" defaultValue={cfg.primaryColor ?? "#1e3a8a"} />
              </div>
              <div>
                <Label>Cor secundária</Label>
                <Input
                  name="secondaryColor"
                  type="color"
                  defaultValue={cfg.secondaryColor ?? "#f59e0b"}
                />
              </div>
            </div>
            <div>
              <Label>Fonte (CSS font-family)</Label>
              <Input name="fontFamily" defaultValue={cfg.fontFamily ?? "system-ui, sans-serif"} />
            </div>
            <div>
              <Label>Texto de capa</Label>
              <Input name="coverText" defaultValue={cfg.coverText ?? ""} placeholder="Universidade Demo" />
            </div>
            <div>
              <Label>Texto de fechamento</Label>
              <Input name="closingText" defaultValue={cfg.closingText ?? ""} placeholder="Bons estudos!" />
            </div>
            <div>
              <Label>URL do logo (opcional)</Label>
              <Input name="logoUrl" defaultValue={cfg.logoUrl ?? ""} placeholder="https://…/logo.png" />
            </div>
            <Button type="submit">Salvar template</Button>
          </form>
        </Card>

        <Card className="flex flex-col justify-center">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Pré-visualização</p>
          <div
            className="rounded-lg p-8 text-center shadow-inner"
            style={{
              backgroundColor: cfg.primaryColor ?? "#1e3a8a",
              fontFamily: cfg.fontFamily ?? "system-ui, sans-serif",
            }}
          >
            <p className="text-lg font-bold text-white">{cfg.coverText || admin.institution.name}</p>
            <p className="mt-2 text-sm" style={{ color: cfg.secondaryColor ?? "#f59e0b" }}>
              Título da aula — professor.ai
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
