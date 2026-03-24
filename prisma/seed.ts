import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@orbitron.io';
  const password = 'admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 워크스페이스 생성
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'kcontent-admin' },
    update: {},
    create: {
      name: 'KContent Studio Admin',
      slug: 'kcontent-admin',
    },
  });

  // 어드민 계정 생성
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
    },
    create: {
      email,
      name: 'Admin',
      password: hashedPassword,
      workspaceMembers: {
        create: {
          workspaceId: workspace.id,
          role: 'OWNER',
        }
      }
    },
  });

  console.log('✅ 어드민 계정 및 워크스페이스가 생성되었습니다!');
  console.log(`이메일: ${email}`);
  console.log(`비밀번호: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
