import { Body, Heading, Link, Tailwind, Text } from '@react-email/components';
import { Html } from '@react-email/html';

interface ResetPasswordProps {
    domain: string;
    token: string;
}

export function ResetPasswordTemplate({ domain, token }: ResetPasswordProps) {
    const resetLink = `${domain}/auth/new-password?token=${token}`;

    return (
        <Tailwind>
            <Html>
                <Body className="text-black">
                    <Heading>Password Reset</Heading>
                    <Text>Reset your VirtualCinema password.</Text>
                    <Link href={resetLink}>Confirm reset</Link>
                    <Text>
                        If this was not you, please ignore this message.
                    </Text>
                </Body>
            </Html>
        </Tailwind>
    );
}
