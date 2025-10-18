import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUp({ email, password: safePassword }: SignUpDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) throw new ConflictException('User already exists!');

    const password = await bcrypt.hash(safePassword, 10);
    const user = await this.prisma.user.create({
      data: { email, password },
    });

    return this.generateToken(user);
  }

  async signIn({ email, password: safePassword }: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials!');

    const isPasswordValid = await bcrypt.compare(safePassword, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials!');

    return this.generateToken(user);
  }

  private generateToken({ email, id }: any) {
    const payload = { email, sub: id };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id, email },
    };
  }
}
