import { Body, Heading, Link, Tailwind, Text } from '@react-email/components';
import { Html } from '@react-email/html';

interface ConfirmTemplateProps {
    domain: string;
    token: string;
}

export function ConfirmTemplate({ domain, token }: ConfirmTemplateProps) {
    const confirmLink = `${domain}/auth/new-verification?token=${token}`;

    return (
        <Tailwind>
            <Html>
                <Body className="text-black">
                    <Heading>Email Confirmation</Heading>
                    <Text>Confirm your email address for VirtualCinema.</Text>
                    <Link href={confirmLink}>Confirm email</Link>
                    <Text>
                        This link is valid for one hour. If this was not you,
                        please ignore this message.
                    </Text>
                </Body>
            </Html>
        </Tailwind>
    );
}
