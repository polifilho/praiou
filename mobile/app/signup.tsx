import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  SafeAreaView,
} from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useAppModal } from "../components/AppModal";

const TERMS_TEXT = `TERMOS E CONDIÇÕES DE USO – ORLA MAIS

Última atualização: 11/02/2026

Bem-vindo ao Orla Mais. Ao acessar ou utilizar nosso aplicativo, você concorda integralmente com os termos e condições descritos abaixo. Caso não concorde, recomendamos que não utilize o aplicativo.

1. SOBRE O ORLA MAIS
O Orla Mais é um aplicativo que conecta usuários finais a barraqueiros e parceiros da orla, permitindo a reserva antecipada de cadeiras de praia, guarda-sóis e itens relacionados, para retirada e pagamento diretamente no local escolhido.

O Orla Mais atua como plataforma intermediadora, não sendo responsável pela execução direta dos serviços prestados pelos parceiros.

2. ACEITAÇÃO DOS TERMOS
Ao criar uma conta, acessar ou utilizar qualquer funcionalidade do aplicativo, o usuário declara que:
• Leu, compreendeu e concorda com estes Termos;
• Possui capacidade legal para contratar;
• Utilizará o app de forma lícita e de acordo com a legislação vigente.

3. CADASTRO DO USUÁRIO
Para utilizar o aplicativo, o usuário deverá:
• Fornecer informações verdadeiras, completas e atualizadas;
• Manter a confidencialidade de seus dados de acesso;
• Ser responsável por qualquer atividade realizada em sua conta.

O Orla Mais pode suspender ou cancelar contas que apresentem uso indevido, informações falsas ou violação destes Termos.

4. FUNCIONAMENTO DAS RESERVAS
• As reservas realizadas no app não configuram pagamento antecipado, salvo se expressamente informado.
• O pagamento é realizado diretamente ao barraqueiro/parceiro, no momento do check-in ou retirada dos itens.
• A reserva garante prioridade e disponibilidade, conforme informado pelo parceiro.

5. RESPONSABILIDADES DO ORLA MAIS
O Orla Mais se compromete a:
• Disponibilizar a plataforma tecnológica para reservas;
• Facilitar a conexão entre usuários e parceiros;
• Informar claramente as regras de uso, reserva e cancelamento.

O Orla Mais não se responsabiliza por:
• Qualidade dos serviços prestados pelos parceiros;
• Condições climáticas, marés ou fatores externos;
• Cancelamentos ou indisponibilidade causados por terceiros.

6. RESPONSABILIDADES DOS PARCEIROS (BARRAQUEIROS)
Os parceiros cadastrados são responsáveis por:
• Cumprir as reservas confirmadas no aplicativo;
• Fornecer os itens anunciados em boas condições de uso;
• Respeitar os preços e condições informados no app;
• Atender o cliente de forma adequada e segura.

7. CANCELAMENTOS E NÃO COMPARECIMENTO
• O usuário pode cancelar a reserva conforme regras informadas no aplicativo.
• Em caso de não comparecimento, a reserva poderá ser cancelada automaticamente.
• Cada parceiro pode ter políticas específicas de cancelamento, informadas previamente.

8. USO INDEVIDO DO APLICATIVO
É proibido:
• Utilizar o app para fins ilegais ou fraudulentos;
• Prejudicar, sobrecarregar ou tentar invadir sistemas do Orla Mais;
• Praticar atos que violem direitos de terceiros.

O descumprimento poderá resultar em suspensão ou exclusão da conta, sem aviso prévio.

9. PROPRIEDADE INTELECTUAL
Todos os direitos relacionados ao aplicativo Orla Mais, incluindo marca, layout, textos, imagens e funcionalidades, são protegidos por lei e pertencem ao Orla Mais ou a seus licenciadores.

É proibida qualquer reprodução sem autorização prévia.

10. PRIVACIDADE E DADOS
O tratamento dos dados pessoais segue nossa Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD).

11. ALTERAÇÕES DOS TERMOS
O Orla Mais poderá atualizar estes Termos a qualquer momento.
As alterações entrarão em vigor após sua publicação no aplicativo.

O uso contínuo da plataforma após alterações significa concordância com os novos termos.

12. LEGISLAÇÃO E FORO
Estes Termos são regidos pelas leis da República Federativa do Brasil.
Fica eleito o foro da comarca de [cidade/estado do responsável legal], para dirimir quaisquer dúvidas.

13. CONTATO
Em caso de dúvidas, sugestões ou solicitações, entre em contato:
📧 info@orlamais.com
`;

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const modal = useAppModal();
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const okName = !!fullName.trim();
    const okEmail = !!email.trim();
    const okPass = password.length >= 6;
    const okMatch = password === password2 && password2.length > 0;
    return okName && okEmail && okPass && okMatch && acceptedTerms && !loading;
  }, [fullName, email, password, password2, acceptedTerms, loading]);

  async function signUp() {
    if (!fullName.trim()) return modal.info("Erro", "Informe seu nome completo.", "Ok");
    if (!email.trim()) return modal.info("Erro", "Informe seu email.", "Ok");
    if (password.length < 6) return modal.info("Erro", "A senha deve ter pelo menos 6 caracteres.", "Ok");
    if (password !== password2) return modal.info("Erro", "As senhas não coincidem.", "Ok");
    if (!acceptedTerms) return modal.info("Erro", "Você precisa aceitar os Termos e Condições.", "Ok");

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "customer",
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });

    setLoading(false);

    if (error) {
      modal.info("Erro", error.message, "Ok");
      return;
    }

    setFullName("");
    setEmail("");
    setPassword("");
    setPassword2("");
    setAcceptedTerms(false);

    modal.confirm({
      title: "Conta criada!",
      message: "Enviamos um email de confirmação. Confirme sua conta para conseguir entrar.",
      confirmText: "Ok",
      variant: "#fb923c",
      onConfirm: () => router.replace("/login"),
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 40, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: 200, height: 200, alignSelf: "center", marginBottom: 24 }}>
          <Image
            source={require("../assets/images/logo.png")}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>

        <Text style={{ fontSize: 24, fontWeight: "900", marginBottom: 16 }}>Criar conta</Text>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Nome completo</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ex: João Silva"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Senha</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="mín. 6 caracteres"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Repetir senha</Text>
            <TextInput
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              placeholder="repita a senha"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
            {password2.length > 0 && password !== password2 ? (
              <Text style={{ marginTop: 6, color: "#b91c1c", fontWeight: "800", fontSize: 12 }}>
                As senhas não coincidem.
              </Text>
            ) : null}
          </View>

          {/* Termos */}
          <View
            style={{
              backgroundColor: "#fff7ed",
              borderColor: "#fed7aa",
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginTop: 6,
            }}
          >
            <Pressable onPress={() => setTermsOpen(true)}>
              <Text style={{ color: "#fb923c", fontWeight: "900" }}>Ler Termos e Condições</Text>
            </Pressable>

            <Pressable
              onPress={() => setAcceptedTerms((v) => !v)}
              style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: acceptedTerms ? "#fb923c" : "#d1d5db",
                  backgroundColor: acceptedTerms ? "#fb923c" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {acceptedTerms ? <Text style={{ color: "white", fontWeight: "900" }}>✓</Text> : null}
              </View>
              <Text style={{ fontWeight: "900", color: "#111827" }}>
                Eu li e aceito os Termos e Condições
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={signUp}
            disabled={!canSubmit}
            style={{
              backgroundColor: "#fb923c",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 6,
              opacity: canSubmit ? 1 : 0.45,
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>
              {loading ? "Criando..." : "Criar conta"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 10 }}>
            <Text style={{ textAlign: "center", color: "#fb923c", fontWeight: "900" }}>
              Já tenho conta
            </Text>
          </Pressable>
        </View>

        {/* Modal Termos */}
        <Modal visible={termsOpen} animationType="slide" onRequestClose={() => setTermsOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>Termos e Condições</Text>
              <Text style={{ color: "#6b7280", marginTop: 4 }}>Role para ler tudo.</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <Text style={{ color: "#111827", lineHeight: 20 }}>{TERMS_TEXT}</Text>
            </ScrollView>

            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
              <Pressable
                onPress={() => setTermsOpen(false)}
                style={{
                  backgroundColor: "#fb923c",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Fechar</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
